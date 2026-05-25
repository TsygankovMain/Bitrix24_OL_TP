#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода заголовков
print_header() {
    echo ""
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}===============================================${NC}"
    echo ""
}

# Функция для вывода успешных сообщений
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Функция для вывода предупреждений
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Функция для вывода ошибок
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_header "🧪 CloudPub тест - получение домена"

# Останавливаем все контейнеры
print_warning "Останавливаем все контейнеры..."
docker compose down > /dev/null 2>&1 || true
docker stop $(docker ps -q) > /dev/null 2>&1 || true
docker network prune -f > /dev/null 2>&1 || true

# Запрос API ключа
echo "Введите API ключ CloudPub:"
read -p "CloudPub API Token: " CLOUDPUB_TOKEN

if [ -z "$CLOUDPUB_TOKEN" ]; then
    print_error "API ключ обязателен!"
    exit 1
fi

# Обновляем .env файл
print_warning "Обновляем .env файл..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/CLOUDPUB_TOKEN='.*'/CLOUDPUB_TOKEN='$CLOUDPUB_TOKEN'/" .env
else
    # Linux
    sed -i "s/CLOUDPUB_TOKEN='.*'/CLOUDPUB_TOKEN='$CLOUDPUB_TOKEN'/" .env
fi

print_success "API ключ сохранен в .env"

# Запускаем только CloudPub и frontend для тестирования
print_header "🚀 Запуск CloudPub контейнера"

echo "Запускаем CloudPub с frontend..."
COMPOSE_PROFILES=frontend,cloudpub docker compose up --build &
DOCKER_PID=$!

print_warning "Ожидание запуска CloudPub..."

# Ждем появления контейнера cloudpub
for i in {1..30}; do
    if docker ps | grep -q cloudpub; then
        print_success "CloudPub контейнер обнаружен!"
        break
    fi
    
    # Проверяем, что процесс Docker еще работает
    if ! kill -0 "$DOCKER_PID" 2>/dev/null; then
        print_error "Docker процесс завершился!"
        exit 1
    fi
    
    echo "Попытка $i/30: ждем запуска контейнера..."
    sleep 2
done

if ! docker ps | grep -q cloudpub; then
    print_error "CloudPub контейнер не запустился за 60 секунд!"
    exit 1
fi

# Получаем имя контейнера CloudPub
CLOUDPUB_CONTAINER=$(docker ps | grep cloudpub | awk '{print $1}')
print_success "CloudPub контейнер: $CLOUDPUB_CONTAINER"

print_header "🔍 Поиск CloudPub домена"

CLOUDPUB_DOMAIN=""
print_warning "Ищем домен в логах CloudPub..."

# Мониторим логи CloudPub в реальном времени
for i in {1..20}; do
    echo "--- Попытка $i/20 ---"
    
    # Получаем свежие логи
    CLOUDPUB_LOGS=$(docker logs "$CLOUDPUB_CONTAINER" 2>&1)
    
    echo "Последние 10 строк логов:"
    echo "$CLOUDPUB_LOGS" | tail -10
    echo ""
    
    # Ищем домен
    CLOUDPUB_DOMAIN=$(echo "$CLOUDPUB_LOGS" | grep -o 'https://[a-zA-Z0-9.-]*\.cloudpub\.[a-z]*' | head -1)
    
    if [ ! -z "$CLOUDPUB_DOMAIN" ]; then
        print_success "Найден домен: $CLOUDPUB_DOMAIN"
        break
    fi
    
    # Проверяем на ошибки
    if echo "$CLOUDPUB_LOGS" | grep -q "Неверный ключ API"; then
        print_error "Неверный API ключ!"
        break
    fi
    
    if echo "$CLOUDPUB_LOGS" | grep -q "Error\|error\|ERROR"; then
        print_warning "Обнаружены ошибки в логах"
    fi
    
    sleep 3
done

print_header "📋 Результаты теста"

if [ ! -z "$CLOUDPUB_DOMAIN" ]; then
    print_success "CloudPub домен успешно получен: $CLOUDPUB_DOMAIN"
    
    # Обновляем VIRTUAL_HOST
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|VIRTUAL_HOST='.*'|VIRTUAL_HOST='$CLOUDPUB_DOMAIN'|" .env
    else
        sed -i "s|VIRTUAL_HOST='.*'|VIRTUAL_HOST='$CLOUDPUB_DOMAIN'|" .env
    fi
    
    print_success "VIRTUAL_HOST обновлен в .env"
    
    echo ""
    echo "Проверьте работу домена:"
    echo "Фронтенд: ${BLUE}$CLOUDPUB_DOMAIN${NC}"
    echo ""
    
else
    print_error "Не удалось получить CloudPub домен"
    echo ""
    echo "Полные логи CloudPub:"
    echo "========================"
    docker logs "$CLOUDPUB_CONTAINER" 2>&1
    echo "========================"
fi

echo ""
print_warning "Для остановки контейнеров: Ctrl+C или docker compose down"
echo ""

# Ждем Ctrl+C
trap 'echo ""; print_warning "Останавливаем контейнеры..."; docker compose down; exit 0' INT
wait
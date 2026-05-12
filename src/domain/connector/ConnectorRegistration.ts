import type { B24Port } from '../../ports/B24Port.js';

export const EMAIL_CONNECTOR_ID = 'comm_hub_email';

export interface ConnectorRegistrationInput {
  appBaseUrl: string;
  connectorId?: string;
}

export async function registerEmailConnector(
  b24: B24Port,
  input: ConnectorRegistrationInput,
): Promise<void> {
  const connectorId = input.connectorId ?? EMAIL_CONNECTOR_ID;
  await b24.callMethod('imconnector.register', {
    ID: connectorId,
    NAME: 'Comm Hub Email',
    ICON: {
      DATA_IMAGE: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22/%3E',
      COLOR: '#2fc6f6',
      SIZE: '90%',
      POSITION: 'center',
    },
    PLACEMENT_HANDLER: `${input.appBaseUrl}/app#/settings/mail`,
    DEL_EXTERNAL_MESSAGES: true,
    EDIT_INTERNAL_MESSAGES: false,
    DEL_INTERNAL_MESSAGES: false,
    NEWSLETTER: false,
    NEED_SYSTEM_MESSAGES: true,
    NEED_SIGNATURE: true,
    CHAT_GROUP: false,
    COMMENT: 'Подключение корпоративной почты к Открытым линиям',
  });
}

export async function setEmailConnectorActive(
  b24: B24Port,
  connectorId: string,
  lineId: number,
  active: boolean,
): Promise<void> {
  await b24.callMethod('imconnector.activate', {
    CONNECTOR: connectorId,
    LINE: lineId,
    ACTIVE: active ? '1' : '0',
  });
}

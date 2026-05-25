import type { AppStore } from '../../vendor/supabase.js';
import type { B24Port } from '../../ports/B24Port.js';
import { setEmailConnectorActive } from '../connector/ConnectorRegistration.js';

export class UninstallFlow {
  constructor(private readonly prisma: AppStore) {}

  async uninstall(portalId: string, b24?: B24Port): Promise<void> {
    const mailbox = await this.prisma.mailbox.findUnique({ where: { portalId } });
    if (mailbox && b24) {
      await setEmailConnectorActive(b24, mailbox.olConnectorId, mailbox.olLineId, false);
    }
    await this.prisma.portal.update({
      where: { id: portalId },
      data: { uninstalledAt: new Date() },
    });
  }
}

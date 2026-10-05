import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TeamStore } from '../core/data/team.store';
import { ServicesStore } from '../core/data/services.store';
import { AuthService } from '../core/auth/auth.service';
import { PendingInvitation, TeamWorker } from '../core/api/models';
import { PnAvatarComponent, PnEmptyComponent, PnSwitchComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/equipo` — `team_screen.dart` plus `worker_settings_screen.dart`.
 *
 * The invitation is a six-digit code that expires in 12 h; the worker types it
 * in the app. On a desk it is also copyable in one click, which is what a shop
 * actually does: copy it into WhatsApp.
 */
@Component({
  selector: 'app-panel-equipo',
  standalone: true,
  imports: [FormsModule, RouterLink, PnAvatarComponent, PnEmptyComponent, PnSwitchComponent, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipo.component.html',
  styleUrl: './equipo.component.css',
})
export class EquipoComponent {
  readonly team = inject(TeamStore);
  readonly services = inject(ServicesStore);
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly picked = signal<TeamWorker | null>(null);
  readonly inviting = signal(false);
  readonly newCode = signal<PendingInvitation | null>(null);
  readonly busy = signal(false);

  inviteEmail = '';

  /** Working alone nothing here is asked for: the server answers 409. */
  readonly hasTeam = this.team.enabled;

  constructor() {
    if (!this.hasTeam()) return;
    void this.team.load();
    void this.team.absences.load();
    void this.services.load();
  }

  servicesOf(worker: TeamWorker): string {
    const names = this.services.all().filter((service) => service.workerIds.includes(worker.id));
    if (names.length === 0) return 'Ningún servicio asignado';
    return `${names.length} de ${this.services.count()} servicios`;
  }

  async toggle(worker: TeamWorker, field: keyof TeamWorker, value: boolean): Promise<void> {
    try {
      await this.team.updateSettings(worker.id, { [field]: value } as Partial<TeamWorker>);
      this.picked.set(this.team.byId(worker.id) ?? null);
    } catch {
      this.toasts.error('No se ha podido cambiar.');
    }
  }

  async toggleService(worker: TeamWorker, serviceId: number, on: boolean): Promise<void> {
    if (!this.services.byId(serviceId)) return;
    try {
      await this.services.setWorker(serviceId, worker.id, on);
    } catch {
      this.toasts.error('No se ha podido cambiar.');
    }
  }

  doesService(worker: TeamWorker, serviceId: number): boolean {
    return this.services.byId(serviceId)?.workerIds.includes(worker.id) ?? false;
  }

  async invite(): Promise<void> {
    this.busy.set(true);
    try {
      const invitation = await this.team.invite(this.inviteEmail.trim() || null);
      this.newCode.set(invitation);
      this.inviteEmail = '';
    } catch {
      this.toasts.error('No se ha podido crear la invitación.');
    } finally {
      this.busy.set(false);
    }
  }

  async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.toasts.show('Código copiado');
    } catch {
      this.toasts.error('Cópialo a mano: ' + code);
    }
  }

  async revoke(invitation: PendingInvitation): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Anular invitación',
      message: 'El código dejará de valer inmediatamente.',
      confirmLabel: 'Anular',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.team.revokeInvitation(invitation.id);
      this.toasts.show('Invitación anulada');
    } catch {
      this.toasts.error('No se ha podido anular.');
    }
  }

  async unlink(worker: TeamWorker): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Eliminar trabajador',
      message:
        `Vas a eliminar permanentemente la cuenta de ${worker.name}. Sus citas pendientes o confirmadas ` +
        'se cancelarán automáticamente con el motivo «Este trabajador ya no se encuentra disponible». ' +
        'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.team.unlink(worker.id);
      this.picked.set(null);
      this.toasts.show('Trabajador eliminado');
    } catch {
      this.toasts.error('No se ha podido eliminar.');
    }
  }
}

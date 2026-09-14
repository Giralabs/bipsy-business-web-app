import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { STORE_LINKS, TRIAL_DAYS } from '../../data/site.data';

/**
 * Temporary destination of "Probar gratis" and "Iniciar sesión" until sign-up
 * and login exist on the web. Instead of a dead button, it says what is coming
 * and offers the app, which already has both.
 */
@Component({
  selector: 'app-soon',
  standalone: true,
  imports: [RouterLink, BipSlotComponent],
  templateUrl: './soon.component.html',
  styleUrl: './soon.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoonComponent implements OnInit {
  kind: 'signup' | 'login' = 'signup';
  readonly stores = STORE_LINKS;
  readonly trialDays = TRIAL_DAYS;

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.kind = this.route.snapshot.data['kind'] === 'login' ? 'login' : 'signup';
  }
}

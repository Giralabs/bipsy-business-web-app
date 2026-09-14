import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { ScreenId } from '../../data/features.data';
import { SampleService } from '../../data/business-types.data';

type BookingState = 'pendiente' | 'confirmada' | 'porCobrar' | 'cobrada' | 'pasada' | 'cancelada' | 'noVino';

interface MockBooking {
  time: string;
  minutes: number;
  customer: string;
  service: string;
  worker: string;
  state: BookingState;
  note?: boolean;
  /** Pending booking that turns into confirmed in a loop. */
  cycles?: boolean;
}

/** Same icons as `BookingStateAction.iconOf` in the app. */
const STATE_ICON: Record<BookingState, string> = {
  pendiente: 'schedule',
  confirmada: 'check',
  porCobrar: 'euro',
  cobrada: 'check_circle',
  pasada: 'history',
  cancelada: 'close',
  noVino: 'person_off',
};

const DEFAULT_SERVICES: SampleService[] = [
  { name: 'Corte + barba', minutes: 45, price: '22 €' },
  { name: 'Corte clásico', minutes: 30, price: '15 €' },
  { name: 'Arreglo de barba', minutes: 20, price: '10 €' },
  { name: 'Afeitado a navaja', minutes: 30, price: '16 €' },
];

/**
 * A phone showing a screen of Bipsy Business, drawn in HTML with the app's own
 * layout and tokens (see `src/styles/app-mockup.css`).
 *
 * Built instead of using screenshots so it follows the visitor's light/dark
 * theme like the app does, stays sharp at any size and can animate: bookings
 * arrive, a pending one gets confirmed, the chart grows. Everything shown is a
 * real screen of the app with demo data.
 */
@Component({
  selector: 'app-phone',
  standalone: true,
  templateUrl: './phone.component.html',
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneComponent implements OnChanges {
  @Input() screen: ScreenId = 'agenda';
  @Input() businessName = 'Barbería Nómada';

  /** Services of the trade, to fill the agenda and the public profile. */
  @Input() services: SampleService[] | null = null;

  bookings: MockBooking[] = [];
  serviceList: SampleService[] = DEFAULT_SERVICES;

  readonly customers = [
    { letter: 'A', people: [{ name: 'Alba Moreno', meta: 'Última cita: 2 sep' }, { name: 'Andrés Gil', meta: 'Próxima: hoy, 12:30' }] },
    { letter: 'C', people: [{ name: 'Carla Ruiz', meta: 'Próxima: hoy, 11:00' }, { name: 'Carlos Vega', meta: 'Última cita: 28 ago' }] },
    { letter: 'D', people: [{ name: 'Diego Martín', meta: 'En lista de espera' }, { name: 'Daniela Ortiz', meta: 'Última cita: 5 sep' }] },
  ];

  readonly bars = [38, 52, 44, 68, 57, 81, 63, 90, 72, 86, 96, 78];

  readonly team = [
    { name: 'María López', status: 'Trabajando desde 09:30', on: true },
    { name: 'Javi Romero', status: 'Trabajando desde 10:00', on: true },
    { name: 'Lucía Martín', status: 'Libre hoy', on: false },
  ];

  readonly waiting = [
    { name: 'Carla Ruiz', when: 'Tardes · esta semana', status: 'Avisada · 18 h' },
    { name: 'Diego Martín', when: 'Cualquier hora', status: 'En espera' },
    { name: 'Alba Moreno', when: 'Mañanas · jue y vie', status: 'En espera' },
  ];

  readonly days = [
    { d: 'LUN', n: 15 },
    { d: 'MAR', n: 16 },
    { d: 'MIÉ', n: 17 },
    { d: 'JUE', n: 18 },
    { d: 'VIE', n: 19 },
  ];

  readonly slots = [
    { t: '10:00', off: false }, { t: '10:30', off: true }, { t: '11:00', off: false },
    { t: '12:00', off: false }, { t: '16:30', off: true }, { t: '17:00', off: false },
    { t: '17:30', off: false }, { t: '18:00', off: false }, { t: '19:00', off: true },
  ];

  readonly effects = ['Destello', 'Partículas', 'Aurora', 'Foco', 'Bokeh', 'Chispas'];
  readonly swatches = ['#C0EED3', '#8796A8', '#E8B657', '#E67676', '#7FB2C7', '#B39DDB', '#F48FB1', '#FFB020'];

  ngOnChanges(): void {
    const s = this.services?.length ? this.services : DEFAULT_SERVICES;
    this.serviceList = s;
    this.bookings = [
      { time: '09:30', minutes: s[0].minutes, customer: 'Laura Sánchez', service: s[0].name, worker: 'María', state: 'cobrada' },
      { time: '10:15', minutes: s[1].minutes, customer: 'Miguel Torres', service: s[1].name, worker: 'Javi', state: 'porCobrar' },
      { time: '11:00', minutes: s[2].minutes, customer: 'Carla Ruiz', service: s[2].name, worker: 'María', state: 'pendiente', cycles: true },
      { time: '12:30', minutes: s[3].minutes, customer: 'Andrés Gil', service: s[3].name, worker: 'Lucía', state: 'confirmada', note: true },
      { time: '13:15', minutes: s[0].minutes, customer: 'Sofía Navarro', service: s[0].name, worker: 'Javi', state: 'confirmada' },
    ];
  }

  /** Which tab of the bottom bar is lit; null for pushed screens without bar. */
  get tabIndex(): number | null {
    switch (this.screen) {
      case 'agenda': return 0;
      case 'chat': return 2;
      case 'clientes': return 3;
      default: return null;
    }
  }

  icon(state: BookingState): string {
    return STATE_ICON[state];
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  /** "45min", "1h", "2h 30m": the format of `_TimeBlock` in the app. */
  duration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
}

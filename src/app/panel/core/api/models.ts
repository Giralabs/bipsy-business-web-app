/**
 * The shapes the API speaks, ported one to one from `packages/gipsi_api`
 * (Dart) so both clients read the same JSON. When a model changes there, it
 * changes here: see `docs/PANEL-SYNC.md`.
 *
 * Dates arrive as ISO-8601 **without a zone** (`yyyy-MM-ddTHH:mm:00`) and are
 * kept as strings; `toDate()` in `src/app/panel/core/util/dates.ts` is the only
 * place that turns them into `Date`, so a stray `new Date(...)` cannot shift an
 * appointment by the browser's offset.
 */

export type Role = 'CUSTOMER' | 'BUSINESS' | 'WORKER' | 'ADMIN';
export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInMs: number;
  role: Role;
  actorId: number;
}

/**
 * `/me`: the session, plus a free-form profile map that drives the whole UI.
 * There is no `username` since backend V105: the email is what signs in.
 */
export interface MeResponse {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
  authProvider: AuthProvider;
  googleLinked: boolean;
  /** Only ever true for someone who signed in with Apple, on the phone. */
  appleLinked?: boolean;
  hasPassword: boolean;
  profile: BusinessProfile | null;
}

/**
 * `MeResponse.profile`. In Dart it is a `Map<String, dynamic>`; typing it here
 * is what lets the templates read `profile.autonomous` without a cast, but it
 * means a new key in the app has to be added here too.
 */
export interface BusinessProfile {
  id: number;
  name: string;
  autonomous: boolean;
  /**
   * False when the business works alone. `autonomous` is the panel's old name
   * for the same idea and both travel; `teamEnabled` is the one the app reads
   * (`teamEnabledProvider`), so new code prefers it.
   */
  teamEnabled?: boolean;
  /** The owner also attends appointments (`booking_settings_screen.dart`). */
  ownerPerforms?: boolean;
  /** How the owner is named as a professional; falls back to `name`. */
  ownerDisplayName?: string | null;
  ownerImageUrl?: string | null;
  clockInEnabled: boolean;
  autoAccept: boolean;
  allowOvertime: boolean;
  available?: boolean;
  chatEnabled: boolean;
  businessChatEnabled?: boolean;
  waitlistEnabled: boolean;
  waitlistManageEnabled?: boolean;
  waitlistNotifyMode: WaitlistNotifyMode;
  waitlistResponseHours: number;
  businessId?: number;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  /**
   * Si se pide tarjeta AHORA MISMO, ya descontado que la cuenta de cobros
   * pueda cobrar (`Business#requiresCardEffective`). Es lo que está en vigor,
   * no lo que el dueño eligió: para pintar su interruptor,
   * [requiresCardIntent].
   */
  requiresCard: boolean;
  /**
   * Lo que el dueño eligió, esté o no en vigor.
   *
   * Es lo que leen su interruptor y la pantalla de cancelaciones: apagárselo
   * porque Stripe todavía está verificando la cuenta sería borrarle una
   * decisión que sí tomó, y volver a preguntársela. Al guardar viaja como
   * `requiresCard`, que es como se llama en `/businesses/me/settings`.
   */
  requiresCardIntent?: boolean;
  /**
   * Si la cuenta de cobros está operativa ahora mismo.
   *
   * Viene en el perfil a propósito, para que el aviso de «te falta configurar
   * los cobros» no cueste una llamada a Stripe en cada arranque.
   */
  payoutsReady?: boolean;
  cancellationFeePercent: number;
  cancellationWindowHours: number;
  /**
   * Whether Bipsy grants trust on its own: five appointments in a row without
   * a no-show and the customer stops being asked for a card (backend V101).
   * Saved through `/businesses/me/settings` under the same name.
   */
  autoTrustEnabled?: boolean;
  availabilityHorizonDays: number;
  slotMinutes: number;
  minBookingNoticeMinutes: number;
  /**
   * Minutes kept free before and after an AT-HOME appointment (V98), 0–120.
   * Zero = none. Saved through `/businesses/me/settings`.
   */
  travelBufferMinutes?: number;
  /** `GipsiServiceMode` of the business as a whole; each service narrows it. */
  serviceMode?: ServiceMode | null;
  worksAtHome?: boolean;
  /** The venue. Null once the business goes at-home only. */
  latitude?: number | null;
  longitude?: number | null;
  /**
   * How far the business travels: centre and radius in km (V99). Apart from
   * the venue on purpose — the venue is wiped when the business becomes
   * at-home only. Radius null or 0 = no limit declared. Written with
   * `PUT /businesses/me/location`, which REPLACES: whoever saves only the
   * address without resending the area loses it.
   */
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  serviceRadiusKm?: number | null;
  bookingLimitEnabled: boolean;
  bookingLimitPerCustomer: number | null;
  onlinePaymentMode: OnlinePaymentMode;
  setupComplete: boolean;
  onboardingComplete: boolean;
  signupRoute: string | null;
  plans: string[];
  entitlements: string[];
  superAccess: boolean;
  subscription: SubscriptionStatus | null;
}

export type OnlinePaymentMode = 'OFF' | 'OPTIONAL' | 'REQUIRED';
export type ServiceMode = 'AT_BUSINESS' | 'AT_CUSTOMER' | 'BOTH';

// ----- BOOKINGS ----------------------------------------------------------

/**
 * `AWAITING_CUSTOMER` is the one the BUSINESS put in the agenda and the
 * customer has not accepted yet, with a deadline running (`confirmExpiresAt`).
 * The mirror of `PENDING`: there the business is awaited, here the customer
 * is. It holds its slot like the other two live ones; if the deadline passes,
 * a server job cancels it.
 */
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'AWAITING_CUSTOMER' | 'CANCELED' | 'NO_SHOW';

/**
 * Where ONE appointment happens. Two values, not the three of `ServiceMode`:
 * «both» describes what a service offers, never a single appointment.
 */
export type BookingPlace = 'AT_BUSINESS' | 'AT_CUSTOMER';

/**
 * `AddressDto`: where the professional goes on an at-home appointment.
 * `oneLine` is composed by the SERVER and is output only.
 */
export interface BookingAddress {
  /** Street and number. */
  address: string | null;
  /** Floor, door, buzzer. */
  details?: string | null;
  city: string | null;
  province?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  oneLine?: string | null;
}

export interface BookingResponse {
  id: number;
  businessId: number;
  businessName?: string;
  /**
   * The account that booked. **Null for a guest**: someone without a Bipsy
   * account the business gave an appointment to, told by email. Name and phone
   * still travel (they come from the agenda card), but nothing that needs an
   * actor works: no ban, no chat, no charge.
   */
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  serviceId: number;
  serviceName: string;
  serviceImageUrl?: string | null;
  workerId: number | null;
  workerName: string | null;
  startDateTime: string;
  endDateTime: string;
  status: BookingStatus;
  notes: string | null;
  cancelReason: string | null;
  priceCents: number | null;
  prepaidCents: number;
  canReview?: boolean;
  businessChatEnabled?: boolean;
  /** Absent on a backend older than V94: then it is at the venue. */
  servicePlace?: BookingPlace;
  /**
   * Where to go, or null. Null means both things on purpose: the appointment
   * is at the venue, or it is at home and nobody stored the address (those
   * from before V94). That it is at home is said by `servicePlace`.
   */
  address?: BookingAddress | null;
  /** An `Instant` (ends in `Z`): read with `fromInstant()`. Null unless AWAITING_CUSTOMER. */
  confirmExpiresAt?: string | null;
  /** Put by the business from its agenda, not by the customer from the app. */
  createdByBusiness?: boolean;
  /** An `Instant`. When the GUEST acknowledged from the email, or null. */
  guestConfirmedAt?: string | null;
  /**
   * Who shows up, when the appointment is NOT for whoever booked it (V108).
   * Null = the holder comes. `customerName` stays the account everything is
   * done with — charging, chat, bans, no-show.
   */
  attendeeName?: string | null;
}

/**
 * Body of `POST /businesses/me/bookings` (`CreateBookingForCustomerRequest`):
 * the appointment the BUSINESS gives from its agenda. Owner only.
 *
 * `businessCustomerId` is the agenda card, NOT the account id. There is no
 * `acceptedPolicy`: that consent is the customer's, collected when they accept.
 */
export interface CreateBookingForCustomerRequest {
  businessCustomerId: number;
  serviceId: number;
  /** Null only when there is nobody to choose. */
  workerId?: number | null;
  /** `yyyy-MM-ddTHH:mm:00`, no zone. */
  startDateTime: string;
  notes?: string | null;
  /** Null only if the service is offered one single way. */
  servicePlace?: BookingPlace | null;
  address?: BookingAddress | null;
}

/**
 * One slot of `GET /services/{id}/availability`. The times are `HH:mm:ss` on
 * the wire. `availableWorkerIds` only comes when no worker was asked for: who
 * is free at that slot.
 */
export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  reason?: string | null;
  availableWorkerIds?: number[] | null;
}

export interface AvailabilityResponse {
  serviceId: number;
  workerId: number | null;
  date: string;
  slotMinutes: number;
  serviceDuration: number;
  slots: AvailabilitySlot[];
}

/**
 * What the agenda paints. The states are not a field: they are derived from
 * status + time + prepayment, exactly like `BookingStateAction.estadoDe` in
 * `booking_card.dart`. Keeping the same names keeps the colours honest.
 */
export type AgendaState =
  | 'pendiente'
  | 'esperandoCliente'
  | 'confirmada'
  | 'pagada'
  | 'pasada'
  | 'cancelada'
  | 'noVino';

// ----- SERVICES ----------------------------------------------------------

/**
 * One band of «Solo a ciertas horas» (`service_hours.dart`). The range is
 * `[startTime, endTime)` and it is compared against the START of the booking.
 * On the wire the times are `HH:mm:ss`; inside the panel they are `HH:mm`,
 * exactly like the app's `hhmm()` helper.
 */
export interface ServiceTimeWindow {
  dayOfWeek: WeekdayName;
  startTime: string;
  endTime: string;
}

/**
 * `GET /businesses/me/slot-grid`: the start times the business really offers,
 * per weekday name. The closing time is NOT in it (these are start times), so
 * the last possible end is `last + slotMinutes`.
 */
export type SlotGrid = Partial<Record<WeekdayName, string[]>>;

export interface ServiceResponse {
  id: number;
  businessId: number;
  businessName?: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  imageUrl: string | null;
  workerIds: number[];
  averageRating: number | null;
  reviewCount: number | null;
  timeWindows?: ServiceTimeWindow[];
  /**
   * Where it is offered IN FORCE, with the business's own mode already
   * applied. What the customer is offered and what gets booked.
   */
  serviceMode?: ServiceMode;
  /**
   * What the business chose for this service, in force or not. The owner's
   * screens read this one; it is kept so going back to «both» restores it.
   */
  serviceModeIntent?: ServiceMode;
  /** Extra charged for going to the customer's home, in cents. Already 0 if it does not travel. */
  homeSurchargeCents?: number;
}

export interface ServicePayload {
  name: string;
  description?: string | null;
  price: number;
  duration: number;
  active?: boolean;
  workerIds?: number[];
  timeWindows?: ServiceTimeWindow[];
  /** On update, null/absent = leave it; on create, null = inherit the business's. */
  serviceMode?: ServiceMode | null;
  /** Cents; 0 = no surcharge. On update, absent = leave it. */
  homeSurchargeCents?: number | null;
}

// ----- SCHEDULE ----------------------------------------------------------

export type WeekdayName =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** `dayOfWeek` is 1 = Monday … 7 = Sunday, and the times are `HH:mm`. */
export interface ScheduleEntry {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// ----- CUSTOMERS ---------------------------------------------------------

/** `BOOKING`: a reservation seeded the card — they found the business in the app on their own. */
export type CustomerSource = 'MANUAL' | 'CONTACTS' | 'BOOKING';

/**
 * `origin` filter of `GET /businesses/me/customers`. `MINE` joins typed and
 * imported cards: what the owner asks is how much clientele Bipsy brings.
 */
export type CustomerOrigin = 'MINE' | 'BIPSY';

export interface BusinessCustomer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: CustomerSource;
  linkedCustomerId: number | null;
  profileImageUrl: string | null;
  invitedAt: string | null;
  banned: boolean;
  bookingCount: number;
  lastBookingAt: string | null;
  /**
   * True if this customer is NOT asked for a card to book here. The only
   * trust level the business sees.
   */
  trusted?: boolean;
  /**
   * True if the business granted it by hand (`PUT …/{id}/trusted`). The
   * automatic one is lost when the customer fails to show; this one is not.
   * The switch paints `trusted`, like `_TrustCard` in the app; this field is
   * what tells that turning it off is not ours to do (`trusted` without it =
   * earned by history, and then it is explained instead).
   */
  trustedManually?: boolean;
  createdAt: string;
}

export interface BusinessCustomerDetail {
  customer: BusinessCustomer;
  bookings: BookingResponse[];
  reviews: ReviewResponse[];
  payments: PaymentResponse[];
  paymentsEnabled: boolean;
}

export interface SaveCustomerRequest {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

// ----- TEAM --------------------------------------------------------------

export interface TeamWorker {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  businessId: number | null;
  available: boolean;
  autoAccept: boolean;
  allowOvertime: boolean;
  chatEnabled: boolean;
  waitlistManageEnabled: boolean;
  profileImageUrl: string | null;
}

export interface PendingInvitation {
  id: number;
  email: string | null;
  token: string;
  expiresAt: string;
  used: boolean;
}

// ----- ABSENCES ----------------------------------------------------------

export type AbsenceType = 'VACATION' | 'PERSONAL' | 'SICK_LEAVE' | 'OTHER';
export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Absence {
  id: number;
  workerId: number;
  workerName: string;
  businessId: number;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: AbsenceStatus;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  conflictingBookingsCount: number;
}

export interface ConflictBooking {
  id: number;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  startDateTime: string;
  endDateTime: string;
  workerName: string | null;
}

export interface AvailableWorker {
  id: number;
  name: string;
}

// ----- TIME CLOCK --------------------------------------------------------

export interface ClockEntry {
  id: number;
  workerId: number;
  workerName?: string;
  checkInAt: string;
  checkOutAt: string | null;
}

export interface ActiveWorkerClock {
  workerId: number;
  workerName: string;
  checkInAt: string;
}

// ----- WAITLIST ----------------------------------------------------------

export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'BOOKED' | 'CANCELED' | 'EXPIRED';
export type WaitlistNotifyMode = 'SEQUENTIAL' | 'BROADCAST';
/** Morning < 14:00, afternoon < 20:00, evening after that. */
export type TimeBand = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface WaitlistOffer {
  id: number;
  entryId: number;
  slotStart: string;
  slotEnd: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'LOST';
  expiresAt: string;
}

export interface BusinessWaitlistEntry {
  id: number;
  position: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerImageUrl: string | null;
  serviceId: number;
  serviceName: string;
  serviceDuration: number;
  workerId: number | null;
  workerName: string | null;
  dateFrom: string;
  dateTo: string;
  timeBands: TimeBand[];
  notes: string | null;
  status: WaitlistStatus;
  missedOffers: number;
  /** An instant (ends in `Z`): read it with `fromInstant()`. */
  waitingSince: string;
  openOffer: WaitlistOffer | null;
}

/** `OfferSlotResponse`: how many were told, and a sentence to show the shop. */
export interface OfferSlotResult {
  notified: number;
  message: string | null;
}

// ----- REVIEWS -----------------------------------------------------------

export interface ReviewResponse {
  id: number;
  bookingId: number;
  customerId: number;
  customerName: string;
  customerProfileImageUrl: string | null;
  businessId: number;
  serviceId: number;
  serviceName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string | null;
  reply: string | null;
  repliedAt: string | null;
}

// ----- CHAT --------------------------------------------------------------

export type ChatSide = 'CUSTOMER' | 'BUSINESS' | 'SYSTEM';
export type ChatMessageKind = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export interface ChatAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Authenticated endpoint, not a public file: it needs the bearer token. */
  url: string;
}

export interface ChatBookingContext {
  id: number;
  serviceName: string;
  startDateTime: string;
  status: BookingStatus;
}

/**
 * `ChatMessageResponse`. `createdAt` is an `Instant` (ends in `Z`): read it
 * with `fromInstant()`, not `toDate()`. There is no per-message read flag —
 * compare with `Conversation.otherLastReadAt`.
 */
export interface ChatMessage {
  id: number;
  side: ChatSide;
  kind: ChatMessageKind;
  body: string | null;
  senderId: number | null;
  senderName: string | null;
  attachment: ChatAttachment | null;
  booking: ChatBookingContext | null;
  clientMessageId: string | null;
  createdAt: string;
}

/** `ConversationResponse`: the other party as seen by whoever asks. Timestamps are instants. */
export interface Conversation {
  id: number;
  businessId: number;
  customerId: number;
  otherPartyName: string;
  otherPartyImageUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageSide: ChatSide | null;
  lastMessageAt: string | null;
  unread: number;
  otherLastReadAt: string | null;
  otherLastDeliveredAt: string | null;
  /** False once the right to write has lapsed: the thread is read-only. */
  canWrite: boolean;
  createdAt: string;
}

// ----- MONEY -------------------------------------------------------------

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'SUCCEEDED'
  | 'REQUIRES_ACTION'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface PaymentResponse {
  id: number;
  kind: string;
  status: PaymentStatus;
  amountCents: number;
  refundedCents: number;
  currency: string;
  description: string | null;
  bookingId: number | null;
  createdAt: string;
}

export type PayoutState = 'NOT_STARTED' | 'PENDING' | 'IN_REVIEW' | 'READY' | 'UNKNOWN';

export interface PayoutAccount {
  state: PayoutState;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  issues: { field: string; message: string }[];
}

/** `PayoutBalanceResponse`, in whole cents. */
export interface PayoutBalance {
  /** Charged but still held by Stripe. */
  pendingCents: number;
  /** Ready to leave for the bank. */
  availableCents: number;
  /** Days Bipsy holds the money before the first payout. */
  delayDays: number;
}

/**
 * `ActivatePayoutsRequest`: the owner's details for the Stripe Connect
 * account. Nothing is stored by Bipsy; it travels once to Stripe.
 */
export interface ActivatePayoutsRequest {
  firstName: string;
  lastName: string;
  /** `yyyy-MM-dd`. */
  dateOfBirth: string;
  /** International format, `+34600000000`. */
  phone: string;
  /** DNI or NIE, optional. */
  idNumber?: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  iban: string;
  acceptedTerms: boolean;
}

/**
 * `UpdatePayoutDetailsRequest`: lo mismo para CORREGIR una cuenta que ya
 * existe.
 *
 * Sin `acceptedTerms` —se aceptaron al crearla, con su fecha y su IP, y volver
 * a pedirlas ensuciaría esa prueba— y con el IBAN opcional: Stripe no devuelve
 * el que hay, así que vacío significa «deja el que tengo».
 */
export interface UpdatePayoutDetailsRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  idNumber?: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  iban?: string;
}

/**
 * `PayoutOwnerDetailsResponse`: lo que Stripe tiene guardado del titular.
 *
 * **El DNI y el IBAN no vuelven nunca**: Stripe no los devuelve. Por eso los
 * dos son opcionales al guardar y dejarlos en blanco no los borra.
 */
export interface PayoutOwnerPrefill {
  firstName: string | null;
  lastName: string | null;
  /** `yyyy-MM-dd`. */
  dateOfBirth: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  /**
   * Los cuatro últimos dígitos del IBAN. Lo único que Stripe devuelve de él, y
   * la única forma que tiene el dueño de saber en qué cuenta está cobrando.
   */
  bankLast4: string | null;
}

/** `VerificationLinkResponse`: enlace de un solo uso, caduca en minutos. */
export interface VerificationLink {
  url: string;
}

/** `PayoutPaymentResponse`: one charge of the business, failed ones included. */
export interface PayoutPayment {
  id: number;
  concept: string;
  amountCents: number;
  /** Held to cover Stripe's fee. Null on old charges. */
  feeCents: number | null;
  /** What the business really keeps. */
  netCents: number;
  status: string;
  failureReason: string | null;
  refundedCents: number;
  refundableCents: number;
  /** `Instant` (UTC, with `Z`): read with `fromInstant()`. */
  createdAt: string;
}

/** `RefundableResponse`: what can be refunded and what it costs. */
export interface PaymentRefundable {
  paymentId: number;
  amountCents: number;
  alreadyRefundedCents: number;
  refundableCents: number;
  /** The original fee, which does not come back. */
  feeLostCents: number;
  canRefund: boolean;
  blockedReason: string | null;
  /** A warning that does not block the refund. */
  warning: string | null;
}

/** `PaymentRefundResponse`. */
export interface PaymentRefund {
  id: number;
  amountCents: number;
  status: string;
  failureReason: string | null;
  reason: string | null;
  /** `Instant` (UTC). */
  createdAt: string;
}

// ----- TIME OFF ----------------------------------------------------------

/**
 * `ClosureResponse` (`/businesses/me/closures`): days the shop does not open,
 * both inclusive. Creating one CANCELS the appointments inside, for every
 * professional; `GET …/affected?startDate&endDate` lists them beforehand.
 */
export interface Closure {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

/** `TimeOffResponse`: a self-approved block of whole days — the owner's own days off. */
export interface TimeOff {
  id: number;
  actorId: number;
  /** `yyyy-MM-dd`, both inclusive. */
  startDate: string;
  endDate: string;
  reason: string | null;
}

// ----- SUBSCRIPTION ------------------------------------------------------

export type SubscriptionState =
  | 'WELCOME_TRIAL'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface SubscriptionStatus {
  state: SubscriptionState;
  blocked: boolean;
  planCode: string | null;
  planName: string | null;
  priceCents: number;
  currency: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysLeft: number | null;
  trialAvailable: boolean;
  canChangePlan: boolean;
  /** Plans worth offering on a voluntary «change plan»; empty = offer all. */
  offeredPlanCodes?: string[];
  /** WELCOME_TRIAL | FREE_PLAN | PAID | NONE — what gave access until it ended. */
  endedAccess?: string | null;
  card?: { brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
}

/**
 * How the payment is completed: IN_APP = Stripe SDK with `clientSecret` (the
 * mobile app), EXTERNAL = a hosted page at `externalUrl`, IAP = the store.
 */
export type CheckoutMode = 'IN_APP' | 'EXTERNAL' | 'IAP';

/** `GET /subscriptions/config`. */
export interface SubscriptionConfig {
  enabled: boolean;
  checkoutMode: CheckoutMode;
  publishableKey: string | null;
  welcomeTrialDays: number;
}

/** `POST /subscriptions/checkout` → `CheckoutResponse`: only one of the three is filled. */
export interface CheckoutResponse {
  checkoutMode: CheckoutMode;
  clientSecret: string | null;
  externalUrl: string | null;
  productId: string | null;
  planCode: string;
  trialEndsAt: string | null;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: 'MONTHLY' | 'ONE_TIME';
  trialDays: number | null;
  selectable: boolean;
  displayOrder: number;
  addon: boolean;
  features: { code: string; name: string; description: string | null }[];
}

/** Feature flags the plans grant. `'*'` is the super-access sentinel. */
export const FeatureCodes = {
  AGENDA: 'AGENDA',
  SERVICES: 'SERVICES',
  TEAM: 'TEAM',
  REVIEWS: 'REVIEWS',
  TIMECLOCK: 'TIMECLOCK',
  CUSTOMERS: 'CUSTOMERS',
  PORTFOLIO: 'PORTFOLIO',
  PORTFOLIO_UNLIMITED: 'PORTFOLIO_UNLIMITED',
  BRANDING: 'BRANDING',
  UNIQUE_ANIMATIONS: 'UNIQUE_ANIMATIONS',
} as const;

// ----- POLICIES, PORTFOLIO, CATEGORIES ----------------------------------

export interface BusinessPolicy {
  id: number;
  text: string;
  templateId: number | null;
  custom: boolean;
  displayOrder: number;
}

export interface PolicyGroup {
  categoryId: number;
  code: string | null;
  name: string;
  icon: string | null;
  custom: boolean;
  displayOrder: number;
  policies: BusinessPolicy[];
}

/** `PortfolioImageResponse`. Edited with `PortfolioImageMetaRequest(caption ≤ 300, serviceId)`. */
export interface PortfolioImage {
  id: number;
  url: string;
  caption: string | null;
  serviceId: number | null;
  serviceName: string | null;
  displayOrder: number;
}

/**
 * `ReferralCodeResponse`. `code` is null until chosen; `editable` is true only
 * for the owner and only while there is no code (it cannot be changed after).
 */
export interface ReferralCode {
  code: string | null;
  editable: boolean;
}

export interface CategoryRef {
  id: number;
  code: string;
  name: string;
  primary?: boolean;
}

// ----- SOCIAL LINKS ------------------------------------------------------

/**
 * `BusinessSocialLinks`, the six networks of `social_links_group.dart`, in the
 * order they are offered. They travel inside `social` of `PUT /businesses/me`
 * and **the six keys always go**: an empty string is how a network is removed.
 *
 * What is stored is the handle, not the URL. The backend is the one that turns
 * a pasted address into a handle, so the panel does not validate the format —
 * it only limits the length, as the app does.
 */
export interface BusinessSocialLinks {
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
}

export type SocialNetwork = keyof BusinessSocialLinks;

// ----- INSTAGRAM (portfolio source) --------------------------------------

/**
 * `GET /businesses/me/instagram/status`. `available` false means the server
 * has no Meta app configured and its endpoints answer 503: then nothing about
 * Instagram is shown.
 */
export interface InstagramStatus {
  available: boolean;
  connected: boolean;
  username?: string | null;
}

/** One photo of `GET /businesses/me/instagram/media`. `id` is a string. */
export interface InstagramMedia {
  id: string;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
}

// ----- SUPPORT -----------------------------------------------------------

export type SupportTicketKind = 'SUPPORT' | 'IMPROVEMENT';

/** Body of `POST /support/tickets` (`CreateTicketRequest`). */
export interface CreateTicketRequest {
  /** Optional, max 150. */
  subject?: string | null;
  /** Required, max 4000. */
  description: string;
  kind: SupportTicketKind;
}

/** `SupportTicketResponse`. Timestamps are instants. `GET /support/tickets/me` pages them. */
export interface SupportTicket {
  id: number;
  requesterId: number;
  requesterName: string;
  requesterRole: string;
  businessId: number | null;
  businessName: string | null;
  kind: SupportTicketKind;
  subject: string | null;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
  attachments: { id: number; filename: string; contentType: string; sizeBytes: number; url: string }[];
  replies: { id: number; adminName: string; body: string; createdAt: string }[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ----- PLACES (address search) ------------------------------------------

/** `PlaceDtos.PlaceSuggestion`: one row of the drop-down. */
export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string | null;
}

/** `PlaceDtos.ResolvedAddress`: `address` is street + number only. */
export interface ResolvedAddress {
  address: string | null;
  streetNumber: string | null;
  formatted: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

// ----- BRANDING (Quality), READ ONLY --------------------------------------
//
// Since 23/09/2026 neither the app nor the panel has a screen that WRITES
// branding: «Personalización» was dropped on purpose (docs/PANEL-SYNC.md §4).
// What survives is what the backend still SERVES inside `BusinessResponse`,
// which the public preview paints. Hence no `UpdateBrandingRequest` here.

export type ShowcaseSection = 'GALLERY' | 'SERVICES' | 'REVIEWS';

/**
 * `BrandingDtos.BrandingView`. Effects travel as enum codes (`NONE`, `GLOW`…);
 * the `animated*Url` fields are absolute URLs or null.
 */
export interface BrandingView {
  accentColor: string | null;
  animatedProfileUrl: string | null;
  animatedCoverUrl: string | null;
  avatarFrame: string;
  coverEffect: string;
  cardEffect: string;
  nameEffect: string;
  sectionOrder: ShowcaseSection[];
}

/**
 * The slice of `BusinessResponse` the owner's screens and the public preview
 * read (`GET /businesses/me`, `GET /businesses/{id}`).
 */
export interface BusinessDetail {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  placeId: string | null;
  description: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  chatEnabled: boolean;
  worksAtHome: boolean;
  serviceMode: ServiceMode | null;
  latitude: number | null;
  longitude: number | null;
  averageRating: number | null;
  reviewCount: number | null;
  categories: CategoryRef[] | null;
  branding: BrandingView | null;
  /** Never null in the response: absent networks come as empty strings. */
  social?: BusinessSocialLinks | null;
  teamEnabled?: boolean;
  ownerPerforms?: boolean;
  ownerDisplayName?: string | null;
  ownerImageUrl?: string | null;
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  serviceRadiusKm?: number | null;
  travelBufferMinutes?: number;
  /** Days a PENDING booking survives before the server cancels it. */
  pendingAutoCancelDays?: number;
}

/** `ScheduleEntryResponse` as it comes from `/businesses/{id}/schedule`. */
export interface PublicScheduleEntry {
  id: number;
  actorId: number;
  dayOfWeek: WeekdayName;
  startTime: string;
  endTime: string;
}

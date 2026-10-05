# Panel web ↔ app Flutter · mapa y protocolo de sincronización

**Última sincronización: 5 de octubre de 2026**, contra `bipsy-mobile-apps/apps/gipsi_business`.

| Repo | Adaptado hasta el commit | Fecha del commit |
|---|---|---|
| `bipsy-mobile-apps` (`main`) | **`12ecaf4`** — *Merge pull request #113 from Giralabs/feat/booking-for-someone-else* | 03/10/2026 |
| `bipsy-backend` (`main`) | **`36134dc`** — *Merge pull request #85 from Giralabs/feat/booking-for-someone-else* | 03/10/2026 |

> **Este es el punto de partida de la próxima sincronización**: lo que haya que trasladar es
> `git log 12ecaf4..HEAD -- apps/gipsi_business packages` en la app y `git log 36134dc..HEAD` en el
> backend. Al terminar, se cambian aquí los dos hashes. (La anterior se quedó en `5eb26d4` y
> `3a9da47`, del 25/09/2026.) En esta máquina `git` no está en el PATH: se usa el de GitHub Desktop,
> `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`.

> **05/10/2026 — domicilio, confianza, cierres, «Dar cita» y entrar por correo** (PRs #107–#113 de
> la app, #79–#85 del backend).
> - **Se entra con el correo** y todas las llamadas llevan `X-Bipsy-Scope: PROFESSIONAL`
>   (`auth.interceptor.ts`). El «usuario» ha desaparecido del alta, de la invitación, de «Tu cuenta»
>   y del equipo (§6).
> - **Servicios a domicilio**: «Dónde se presta» y «Recargo a domicilio» por servicio, «Ida y vuelta
>   a domicilio» en Reservas y «Zona de desplazamiento» en «Editar tu ficha».
> - **Clientes de confianza**: interruptor en la ficha, automática en Funcionalidades, y los filtros
>   de la lista (origen, de confianza, con/sin cita) resueltos por el servidor.
> - **Días de cierre** (`/panel/ajustes/cierres`), que sustituye a «Tiempo libre»; los días libres del
>   dueño pasan a Equipo › Ausencias como «Yo», y el negocio puede quitar cualquier ausencia.
> - **Agenda**: estado «Esperando al cliente», citas de invitados sin app, citas a domicilio con su
>   dirección, citas para otra persona y **«Dar cita»** desde la agenda.
> - Avisos: fila «Lista de espera» y cada aviso abre su pantalla.

> **23/09/2026 — se retira «Personalización» y llegan las horas por servicio.**
> La pantalla de marca Quality (`/panel/negocio/marca`) **se ha quitado a propósito**: la app la
> disolvió y el dueño ha decidido no reponerla en la web (§4, «Personalización»). De la app se han
> traído: **«Solo a ciertas horas»** por servicio (`servicios/service-hours.ts`), las **redes
> sociales** de la ficha, **Cancelaciones** como pantalla propia (`/panel/ajustes/cancelaciones`),
> el bloque **«Tú y tu horario»** del dueño como profesional, el interruptor **«Trabajar con más
> gente»** con su estado «Trabajas solo», los **avisos de que hacen falta cobros** antes de pedir
> tarjeta o cobrar por la app, **importar de Instagram** en el portfolio y **vincular Google** en
> «Tu cuenta».
>
> 22/09/2026 — barra lateral y modo trabajador. La navegación por bloques se sustituyó por una
> barra lateral mínima (`panel/shell/`), plegable a carril (⌘/Ctrl B), cajón en el móvil y con un
> buscador «Ir a…» (⌘/Ctrl K, `command-palette.component.ts`) que conoce también los destinos de
> segundo nivel. El inicio ya no repite las secciones: cabecera con Mr. Bip (`ui/desk-hero`), el día
> y los avisos. Los **trabajadores** tienen ya su panel (§3, «Trabajador»), y se corrigieron varios
> contratos con el backend que no funcionaban (horario, fichajes, reseñas, chat, servicios…; §6).
>
> 18/09/2026: agenda con columnas-panel, citas teñidas por su estado y pago por Stripe desde el
> ordenador. El sistema visual vive en `src/styles/panel.css`.

El panel de `/panel/**` es una réplica para escritorio de la app **Bipsy Negocio**
(`bipsy-mobile-apps/apps/gipsi_business`). La app es la fuente de verdad: cuando cambia, la web va
detrás. Este documento es lo que hace posible esa puesta al día sin releer el proyecto entero.

---

## 1. Protocolo: cómo se actualiza la web cuando cambia la app

Cuando se pida **«actualiza la app web angular de acuerdo con la app»**:

1. **Leer este documento entero**, sobre todo la fecha de arriba y la tabla de §3.
2. **Ver qué ha cambiado en la app** desde esa fecha, en este orden de importancia:
   - `apps/gipsi_business/lib/features/**` — pantallas y lógica de negocio.
   - `apps/gipsi_business/lib/l10n/app_es.arb` — todos los textos de la interfaz.
   - `packages/gipsi_api/lib/src/models/**` — contrato de datos.
   - `packages/gipsi_api/lib/src/repositories/**` — endpoints que se llaman.
   - `packages/gipsi_shared_ui/lib/src/tokens/**` — colores, espaciados, radios.
   - `apps/gipsi_business/lib/router/app_router.dart` — rutas y guardias.
3. **Trasladar los cambios** al archivo Angular que diga la tabla de §3.
   - Modelo nuevo o campo nuevo → `src/app/panel/core/api/models.ts`.
   - Endpoint nuevo → el store correspondiente en `src/app/panel/core/data/`.
   - Texto cambiado → el `.html` de la pantalla. **Los textos van en español y literales**,
     copiados del ARB, no traducidos a mano.
   - Token de diseño cambiado → `src/styles/panel.css` (y `src/styles.css` si es un token común).
   - Paso nuevo del tutorial → `src/app/panel/onboarding/coach.service.ts`.
   - Ítem nuevo del checklist → `src/app/panel/core/data/setup.store.ts`.
4. **Comprobar que compila**: `npm run build`.
5. **Actualizar este documento**: la fecha de arriba, la tabla si hay pantallas nuevas, y §5 si algo
   pasa de pendiente a hecho o al revés.

> Si un cambio de la app no tiene sentido en escritorio (gestos, contactos del teléfono, cámara,
> compras dentro de la app), **no se copia a ciegas**: se anota en §4 como divergencia deliberada.

---

## 2. Cómo está montado el panel

```
src/app/panel/
├── core/
│   ├── api/        models.ts · api.ts · api.config.ts   ← contrato y cliente HTTP
│   ├── auth/       auth.service.ts · auth.guard.ts · auth.interceptor.ts · token-storage.ts
│   ├── data/       un store por dominio (el equivalente a los providers de Riverpod)
│   ├── agenda/     booking-state.ts                      ← los 6 estados de una cita
│   └── util/       dates.ts · format.ts
├── ui/             kit compartido (diálogo, switch, segmentado, avatar, toasts, confirmación)
├── onboarding/     coach.service.ts · coach-overlay.component.ts   ← el tutorial guiado
├── shell/          panel-shell.component.* · sections.ts · command-palette.component.*
│                                                         ← barra lateral, cuenta e «Ir a…»
├── auth/           login · signup · recover · join (/unirse) · accept-invite (/invitacion/:token)
├── trabajador/     inicio · fichar · mi-horario · mis-ausencias · mi-perfil
└── <sección>/      una carpeta por sección del panel
```

**Quién ve qué.** Dueño y trabajador entran por el mismo `/auth/login`; lo decide `role` de `/me`
(`AuthService.isBusiness()` / `isWorker()`). Las secciones de la barra salen de `BUSINESS_SECTIONS`
o `WORKER_SECTIONS` en `shell/sections.ts`, y `panelGuard` (también como `canActivateChild`) no
deja a un trabajador abrir pantallas del dueño (`WORKER_PATHS` en `auth.guard.ts`). Para un
trabajador, `profile` es su `WorkerResponse`: el id del negocio es `AuthService.businessId()` (nunca
`profile.id`) y el nombre del negocio sale de `GET /businesses/{businessId}` (`auth.employer()`).

**Reglas de la casa** (las mismas que el resto del proyecto):

- Componentes `standalone` con `ChangeDetectionStrategy.OnPush`.
- Comentarios del código **en inglés**; textos de interfaz **en español**.
- Estado con **signals**; nada de RxJS salvo lo que exige `HttpClient`.
- Los estilos del panel viven en `src/styles/panel.css` con prefijo `pn-`; lo específico de una
  pantalla, en su `.css`.
- El acento del panel es **monocromo** (grafito en claro, casi blanco en oscuro), como
  `apps/gipsi_business/lib/app.dart`. El menta es de la app de cliente y aquí solo se usa como
  toque de marca.
- Superficies en modo **lift**: una tarjeta se distingue porque es más clara que el fondo. **Sin
  sombras ni bordes.**

### Mantenimiento, 404 y errores (05/10/2026; no vienen de la app)

`src/app/maintenance/` consulta `GET /maintenance/status?site=BUSINESS_WEB` al arrancar y cada
minuto. Si la web está en mantenimiento (se enciende desde bipsy-admin-app › Mantenimiento), el
componente raíz pinta solo la página de mantenimiento y `maintenanceGate` retiene la navegación,
así que el panel no llega a llamar a la API. `/admin` pide la contraseña del equipo
(`POST /maintenance/unlock`) **solo mientras hay mantenimiento**; si no, es un 404 como cualquier
otro. El 404 del sitio, el del panel (`panel/shell/panel-not-found.component.ts`) y `/error`
comparten `components/status-page`. Si la API no contesta al arrancar, la web se abre.

### A qué API habla

`src/app/panel/core/api/api.config.ts`: en `localhost` habla con `http://localhost:8080`; en
cualquier otro sitio, con `https://gipsi-api.onrender.com`, la misma que la app Flutter.
`window.__BIPSY_API__` (una línea en `index.html`) manda sobre las dos. **Ya no existe el modo demo**
ni su carpeta. Antes de publicar hay que añadir el dominio de la web a `CORS_ALLOWED_ORIGINS` en el
backend.

---

## 3. Mapa: pantalla de la app → archivo de la web

### Acceso

| App (Flutter) | Web (Angular) | Ruta web |
|---|---|---|
| `auth/login_screen.dart` | `panel/auth/login.component.*` | `/acceder` |
| `auth/signup/step1..step5` | `panel/auth/signup.component.*` | `/registro` |
| `auth/recover/recover_password_screen.dart` | `panel/auth/recover.component.*` | `/recuperar-contrasena` |
| `auth/email_pending_screen_business.dart` | `panel/soporte/verificar-email.component.ts` | `/panel/verificar-email` |
| `router/app_router.dart` (redirect) | `panel/core/auth/auth.guard.ts` | — |
| `auth/enter_invitation_code_screen.dart` · `waiting_invitation_screen.dart` | `panel/auth/join.component.ts` | `/unirse` |
| `auth/accept_invitation_screen.dart` | `panel/auth/accept-invite.component.ts` | `/invitacion/:token` |

### Trabajador

| App (Flutter) | Web (Angular) | Ruta web |
|---|---|---|
| `shell/main_shell.dart` (`_tabsFor`, rol WORKER) | `WORKER_SECTIONS` en `panel/shell/sections.ts` | — |
| `home/worker_home.dart` | `panel/trabajador/inicio-trabajador.component.ts` (vía `inicio/home-switch`) | `/panel` |
| `home/worker_home.dart` (pestañas Hoy/Pendientes/Agenda) | `panel/agenda/agenda.component.*` con `/bookings/me/worker` | `/panel/agenda` |
| `timeclock/timeclock_screen.dart` | `panel/trabajador/fichar.component.ts` | `/panel/fichar` |
| `schedule/my_schedule_screen.dart` | `panel/trabajador/mi-horario.component.ts` | `/panel/mi-horario` |
| `absences/my_absences_screen.dart` · `widgets/request_absence_sheet.dart` | `panel/trabajador/mis-ausencias.component.ts` | `/panel/mis-ausencias` |
| `profile/profile_screen.dart` (`_WorkerSelfSettingsSection`) · `widgets/edit_worker_screen.dart` · `worker_avatar_picker_sheet.dart` · `referral/referral_screen.dart` | `panel/trabajador/mi-perfil.component.ts` | `/panel/mi-perfil` |
| `reviews/reviews_screen.dart` (solo lectura) | `panel/resenas/resenas.component.*` (`canReply` = dueño) | `/panel/resenas` |
| `timeclock_providers.dart` · `absences_providers.dart` (`/absences/me`) | `panel/core/data/my-work.store.ts` | — |

### Producto

| App (Flutter) | Web (Angular) | Ruta web |
|---|---|---|
| `shell/main_shell.dart` (barra inferior) | `panel/shell/panel-shell.component.*` (barra lateral) | — |
| `home/business_home.dart` · `widgets/booking_card.dart` · `booking_list.dart` | `panel/agenda/agenda.component.*` · `agenda-grid.component.*` · `booking-dialog.component.*` | `/panel/agenda` |
| `home/widgets/status_legend_sheet.dart` | diálogo de leyenda en `agenda.component.html` | — |
| `home/create_booking_screen.dart` · `widgets/customer_picker_sheet.dart` · `widgets/slot_picker_sheet.dart` | `panel/agenda/create-booking-dialog.component.*` (botón «Dar cita» y clic en un hueco de la rejilla; solo dueño) | diálogo en `/panel/agenda` |
| `customers/widgets/customer_filters_sheet.dart` · `customer_tile.dart` | segmentado y chips de `panel/clientes/clientes.component.*` · `core/data/customers.store.ts` | `/panel/clientes` |
| `profile/widgets/service_mode_sheet.dart` · `service_area_sheet.dart` | bloques «Dónde se presta» (`servicios.component.*`) y «Zona de desplazamiento» (`negocio.component.*`) | — |
| `absences/widgets/create_direct_absence_sheet.dart` · `timeoff_providers.dart` (el dueño como «Yo») | diálogo «Registrar ausencia» de `panel/equipo/ausencias.component.*` | `/panel/equipo/ausencias` |
| — *(no existe en la app)* | `panel/inicio/inicio.component.*` | `/panel` |
| `services/services_screen.dart` · `service_form_screen.dart` | `panel/servicios/servicios.component.*` | `/panel/servicios` |
| `services/service_hours.dart` · `core/time_ranges.dart` · `widgets/service_hours_selector.dart` · `widgets/service_day_hours_sheet.dart` | `panel/servicios/service-hours.ts` (reglas) · `service-hours.component.ts` (`pn-service-hours`, dentro del formulario) | — |
| `customers/customers_screen.dart` | `panel/clientes/clientes.component.*` | `/panel/clientes` |
| `customers/customer_detail_screen.dart` | `panel/clientes/cliente-detalle.component.*` | `/panel/clientes/:id` |
| `customers/import_contacts_screen.dart` | `panel/clientes/importar.component.*` + `panel/clientes/contacts-source.ts` (Contact Picker API, vCard y CSV) | `/panel/clientes/importar` |
| `team/team_screen.dart` · `worker_settings_screen.dart` · `invite_worker_sheet.dart` | `panel/equipo/equipo.component.*` | `/panel/equipo` |
| `timeclock/business_timeclock_screen.dart` | `panel/equipo/fichajes.component.*` | `/panel/equipo/fichajes` |
| `absences/business_absences_screen.dart` · `conflict_resolver_screen.dart` | `panel/equipo/ausencias.component.*` | `/panel/equipo/ausencias` |
| `chat/chat_inbox_screen.dart` · `chat_thread_screen.dart` | `panel/mensajes/mensajes.component.*` | `/panel/mensajes` |
| `waitlist/waitlist_screen.dart` · `waitlist_settings_screen.dart` | `panel/agenda/waitlist-panel.component.*` | `/panel/agenda?vista=espera` |
| `profile/edit_business_screen.dart` (datos, modalidad y dirección) + hub de `profile_screen.dart` · `widgets/business_image_picker_sheet.dart` | `panel/negocio/negocio.component.*` | `/panel/negocio` |
| `gipsi_shared_ui/…/gipsi_address_search_field.dart` · `gipsi_api/…/places_repository.dart` | `panel/ui/address-search.component.ts` (`pn-address-search`; también en el paso 4 del alta) | — |
| `profile/widgets/social_links_group.dart` | bloque «Redes sociales» del diálogo de `panel/negocio/negocio.component.*` (`SOCIAL_NETWORKS`) | `/panel/negocio` |
| `branding/**` · `profile/widgets/section_order_group.dart` | **nada**: retirado el 23/09/2026 (§4, «Personalización»). `BrandingView` sigue en `models.ts` **solo de lectura**, para la vista previa | — |
| `preview/business_preview_screen.dart` · `preview_providers.dart` · `gipsi_shared_ui/…/gipsi_business_detail_body.dart` (+ `gipsi_service_row`, `gipsi_review_card`, `gipsi_portfolio_strip`, `gipsi_policies_section`, `gipsi_rating`, `gipsi_business_schedule_sheet`) · `bipsy-web-app/…/pages/business-detail/*` | `panel/negocio/vista-previa.component.*` (conmutador y marcos) · `preview-web.component.*` (copia de la web de cliente) · `preview-app.component.*` (port del widget compartido, marco Android e iPhone) · `preview-model.ts` (datos y formato comunes) | `/panel/negocio/vista-previa` |
| `onboarding/onboarding_schedule_screen.dart` · `schedule/widgets/week_schedule_editor.dart` | `panel/negocio/horario.component.*` | `/panel/negocio/horario` |
| `portfolio/portfolio_screen.dart` · `portfolio/instagram_import_screen.dart` · `widgets/instagram_connect_sheet.dart` | `panel/negocio/portfolio.component.*` (incluida la importación de Instagram) | `/panel/negocio/portfolio` |
| `policies/policies_screen.dart` | `panel/negocio/normas.component.ts` | `/panel/negocio/normas` |
| `referral/referral_screen.dart` | `panel/negocio/codigo.component.ts` | `/panel/negocio/codigo` |
| `reviews/reviews_screen.dart` | `panel/resenas/resenas.component.*` | `/panel/resenas` |
| `profile/profile_screen.dart` (menú) | `panel/ajustes/ajustes.component.ts` | `/panel/ajustes` |
| `profile/booking_settings_screen.dart` (incluido el bloque «Tú y tu horario»: `ownerPerforms`, `ownerDisplayName`, foto del dueño y horas extra) | `panel/ajustes/reservas.component.*` | `/panel/ajustes/reservas` |
| `profile/features_screen.dart` (con `teamEnabled` y los avisos de «primero, la cuenta de cobros») | `panel/ajustes/funcionalidades.component.ts` | `/panel/ajustes/funcionalidades` |
| `profile/cancellation_policy_screen.dart` · `core/cancellation_policy.dart` · `widgets/policy_slider_row.dart` | `panel/ajustes/cancelaciones.component.ts` (`CANCELLATION_LIMITS`) | `/panel/ajustes/cancelaciones` |
| `profile/payouts_screen.dart` (estado, `_ActivationForm`, saldo y cobros) · `payments/widgets/payment_refund_sheet.dart` | `panel/ajustes/cobros.component.ts` · `payouts-form.component.ts` · `payout-refund-dialog.component.ts` | `/panel/ajustes/cobros` |
| `absences/business_closures_screen.dart` · `closure_providers.dart` | `panel/ajustes/cierres.component.ts` | `/panel/ajustes/cierres` (`/panel/ajustes/tiempo-libre` redirige aquí) |
| `profile/notifications_screen_business.dart` · `notification_prefs_provider_business.dart` (claves `notif_*`) | `panel/ajustes/notificaciones.component.ts` · `panel/core/data/desktop-notify.service.ts` | `/panel/ajustes/notificaciones` |
| `subscription/subscription_screen.dart` | `panel/ajustes/suscripcion.component.ts` | `/panel/ajustes/suscripcion` |
| `subscription/plan_selection_screen.dart` (paywall) | `panel/ajustes/plan-wall.component.ts` | `/panel/plan` |
| `profile/change_password_screen.dart` · `profile/linked_accounts_screen.dart` (solo la fila de Google) | `panel/ajustes/cuenta.component.ts` | `/panel/ajustes/cuenta` |
| `support/support_screen.dart` · `new_ticket_screen.dart` | `panel/soporte/soporte.component.ts` | `/panel/soporte` |
| `welcome/coach_controller.dart` · `coach_overlay.dart` | `panel/onboarding/coach.service.ts` · `coach-overlay.component.*` | — |
| `welcome/welcome_providers.dart` (`setupStepsProvider`) | `panel/core/data/setup.store.ts` | bloque de `/panel` |

### Datos

| App (Flutter) | Web (Angular) |
|---|---|
| `packages/gipsi_api/lib/src/models/**` | `panel/core/api/models.ts` |
| `packages/gipsi_api/lib/src/client/api_client.dart` | `panel/core/api/api.ts` + `auth.interceptor.ts` |
| `features/auth/auth_controller.dart` | `panel/core/auth/auth.service.ts` |
| `features/home/bookings_providers.dart` | `panel/core/data/agenda.store.ts` |
| `features/services/services_providers.dart` | `panel/core/data/services.store.ts` |
| `features/customers/customers_providers.dart` | `panel/core/data/customers.store.ts` |
| `features/team/team_providers.dart` + `absences_providers.dart` + `timeclock_providers.dart` | `panel/core/data/team.store.ts` |
| `features/waitlist/waitlist_providers.dart` | `panel/core/data/waitlist.store.ts` |
| `features/reviews/reviews_providers.dart` | `panel/core/data/reviews.store.ts` |
| `features/chat/chat_providers.dart` | `panel/core/data/inbox.store.ts` |
| `features/home/widgets/booking_card.dart` (`EstadoCita`) | `panel/core/agenda/booking-state.ts` |

---

## 4. Divergencias deliberadas

Cosas en las que la web **no** copia a la app, a propósito. Si la app cambia en estos puntos, hay
que decidir antes de tocar nada.

| Tema | App | Web | Por qué |
|---|---|---|---|
| Navegación | Barra inferior de 4 pestañas (3 para un trabajador) | **Barra lateral mínima** con todas las secciones, plegable a carril, y «Ir a…» (⌘/Ctrl K) para lo de segundo nivel | En un escritorio sobra sitio a la izquierda y las secciones se ven siempre, sin volver a un escritorio de bloques. |
| Pantalla de inicio | Abre directamente en la agenda | Inicio (`/panel`): Mr. Bip, el día, pendientes y avisos; para un trabajador, su día, su fichaje y su disponibilidad | En un móvil cabe una cosa; en un escritorio caben el día y lo pendiente a la vez. |
| Guardias por rol | Ninguna: las pantallas del dueño se abren y falla el servidor | `panelGuard` manda a un trabajador a `/panel` fuera de `WORKER_PATHS` | En la web se teclea una URL con facilidad. |
| Entrar con Google o Apple | Solo negocios. Apple únicamente en iOS | Igual, y el login lo dice. Apple **sí sale en la web**: por el navegador el flujo es la misma ventana emergente para todos, no la hoja del sistema | `/auth/{google,apple}/business` rechaza trabajadores. Lo de «solo iOS» era por no meter a Android en una ventana web pudiendo usar Google nativo; en un navegador esa distinción no existe. |
| Alta con Google o Apple | El login sin cuenta (404) sigue al registro con la identidad en la mano | Igual, y además los dos botones están **también en `/registro`**: el paso 1 es «escribe tu correo» *o* «tráelo de Google/Apple» | En la app el alta se abre desde el login; en la web se llega a `/registro` por enlace directo desde la portada, y allí no había forma de empezar con un proveedor. Con proveedor no hay contraseña que elegir (`RegisterBusinessRequest`: password, googleIdToken **o** appleIdToken, uno y sólo uno) ni paso de verificación, salvo con el relay de Apple, donde el correo lo escribe el negocio y hay que comprobarlo. |
| Registro de trabajador sin código | `/register/worker` | No existe: el trabajador entra con código (`/unirse`) | Sin negocio no puede hacer nada; quien ya se registró en la app sin código canjea uno en `/unirse`. |
| Vetar desde una cita (trabajador) | El botón sale y da 403 | No sale | `/businesses/me/bans/**` es solo BUSINESS. |
| Agenda | Lista por día con segmentado | Rejilla semanal, rejilla del día por trabajador y lista | El dato disponible es el mismo (`GET /bookings/me/business`, sin rango); lo que cambia es el sitio para pintarlo. |
| Acciones sobre una cita | Dos hojas: detalle y acciones | Un solo diálogo con ambas | Quita el problema de «dónde toco» que la app tiene que explicar en la leyenda. |
| Reasignar trabajador | Solo dentro del resolutor de conflictos | También desde cualquier cita | Mismo endpoint (`PUT /bookings/{id}/reassign`); desde el mostrador es lo natural cuando alguien falla. |
| Ofrecer hueco a la lista de espera | El endpoint existe pero **ninguna pantalla lo llama** | Botón en el panel de espera | `POST /businesses/me/waitlist/{id}/offer` ya está en el backend y en `WaitlistRepository`. |
| Paso 5 del tutorial («Tu equipo») | Se salta siempre: nadie registra la diana `nav:team` | Funciona | En la web la sección es una pestaña y se puede señalar. |
| Importar contactos (paso 8 del tutorial) | `flutter_contacts` lee la agenda del teléfono tras pedir permiso | `/panel/clientes/importar` con dos vías y **ninguna caja de texto**: (1) la **Contact Picker API** (`navigator.contacts.select(['name','tel','email'], {multiple:true})`), que es la agenda de verdad del móvil y solo se ofrece donde existe —Chrome en Android y en https—; (2) un **archivo**: `.vcf` (vCard 2.1/3.0/4.0, con nombres en quoted-printable o base64) o `.csv` de Google Contacts, Outlook o el programa anterior, arrastrado o elegido, detectando delimitador y cabeceras en español e inglés, y también sin cabecera. Todo se interpreta en el navegador (`contacts-source.ts`); si ninguna encaja, un bloque explica que la app del móvil sí lee la agenda. Después, la misma revisión que la app y el mismo `POST /businesses/me/customers/import` | El navegador de un ordenador no tiene agenda que leer, y pedir la lista escrita a mano era lo peor de las dos opciones. El Contact Picker cubre el caso en que el panel se abre desde el móvil; el archivo cubre el escritorio. Los que ya están en la agenda vienen desmarcados (el servidor los descartaría igual) y el tope de 500 es el de `ImportContactsRequest`. |
| Reordenar (servicios, espera) | Arrastrar con pulsación larga | Flechas arriba/abajo | Más rápido con ratón y accesible con teclado. |
| Chat | WebSocket con cabecera `Authorization`; adjuntar con cámara, galería o documento | **Mismo socket** (`core/data/chat-socket.service.ts`): `/ws/chat` crudo (sin STOMP), eventos JSON `message.created` · `conversation.read` · `conversation.delivered`, y el token en el subprotocolo `['bipsy-bearer', <jwt>]` porque el navegador no deja poner cabeceras. Si el handshake falla se hace una llamada REST para que el interceptor refresque y se reintenta (2 s → 30 s); mientras está caído, `InboxStore` relee cada 20 s. Adjuntar es un solo botón con selector de archivos, además de pegar y arrastrar; las imágenes se ven en un visor con «Descargar» en vez de «Guardar o compartir» | En un navegador no hay cámara ni hoja de compartir del sistema; pegar y arrastrar es lo natural en un escritorio. |
| Tema claro/oscuro | Interruptor propio, persistido | Sigue al sistema | Es como funciona el resto de la web informativa. |
| Suscripción | Compras integradas de Google Play y App Store (IAP) | **Tarjeta con Stripe** (Payment Element de Stripe.js, `panel/ajustes/stripe-checkout.ts`): `GET /subscriptions/config?channel=WEB` → `POST /subscriptions/checkout {planCode, channel:'WEB'}` (SetupIntent) → `stripe.confirmSetup` → `POST /subscriptions/confirm {paymentMethodId}`. Cambio, baja y reactivación en «Mi plan». | Desde un ordenador no hay tienda. `channel: 'WEB'` es el único añadido al backend (22/09/2026): `SubscriptionService` usa `StripeSubscriptionGateway` para la web aunque la pasarela viva sea la de las tiendas, y cada suscripción se gestiona con la pasarela con la que se abrió (`gatewayFor`). Lo contratado en el móvil se gestiona en el móvil. Solo se ofrecen planes `selectable` (`/subscriptions/plans`): el gratis lo regala Bipsy desde bipsy-admin-app. |
| Subir fotos | Desde la galería del móvil, en una hoja | `pn-photo-picker`: elegir archivo o arrastrar y soltar. Fotos JPEG/PNG/WebP hasta 5 MB (`MediaValidation.MAX_SIZE`); animadas GIF/WebP hasta 8 MB. En el portfolio la descripción y el servicio se piden antes de subir y viajan en el mismo multipart (`caption`, `serviceId`) | En un escritorio no hay galería; arrastrar es lo natural. |
| **Personalización (Quality)** | Dejó de ser una pantalla: el **orden de la ficha** se mudó a Editar perfil (ya sin plan, backend V86) y la **foto/portada animadas** a la hoja de la foto. Color y efectos no tienen ya dónde tocarse | **Nada. Retirada a propósito el 23/09/2026.** Se borraron `negocio/marca.component.*`, su ruta, su destino en la barra, su enlace en «Tu ficha» y `UpdateBrandingRequest`. Tampoco se ha traído el orden de secciones de Editar perfil | Decisión del dueño: en la web no queda ningún sitio donde escribir marca. `BrandingView` y `ShowcaseSection` **se quedan en `models.ts` solo de lectura** porque la vista previa pinta el color, las animadas y el orden que el backend sigue sirviendo dentro de `BusinessResponse`. Si algún día se quiere el orden de secciones, es `PUT /businesses/me/branding` con el **estado completo** (mandar solo `sectionOrder` borra color y efectos) y puede devolver 402. |
| Tutorial de Quality | Sigue existiendo (`CoachTour.quality`, 3 pasos), pero ya no señala nada: los tres se quedan en Perfil | Los mismos 3 pasos y las mismas palabras del ARB; el segundo ya no va a `/panel/negocio/marca`, se queda en `/panel/negocio` | La app conserva el texto («tu color… los efectos… lo vas viendo en vivo») aunque no haya dónde tocarlo: se copia literal, como manda §1.3, y describe lo que Quality hace en tu ficha, no dónde se edita. |
| Redes sociales | Se añaden de una en una: hoja «¿Qué quieres añadir?» y luego otra hoja por red, con el valor y un «Quitar» | Las **seis cajas a la vez** en el diálogo de «Editar tu ficha», en dos columnas; vacía = no la tienes | En un móvil seis campos son seis pantallas de scroll; en un escritorio caben de un vistazo y se rellenan con el tabulador. El contrato es el mismo: las seis claves viajan siempre en `social`, y `''` borra. |
| Horas por servicio | Lista de días → hoja del día → rueda por hora | Los siete días abiertos a la vez dentro del formulario, con dos `select` por franja | Una hoja dentro de un diálogo sería la tercera capa de modal seguida. Las reglas son idénticas (`service-hours.ts`): las horas salen de `/businesses/me/slot-grid`, el fin incluye el cierre (`última + slotMinutes`), las franjas que se tocan se funden y apagar el interruptor manda `timeWindows: []`. |
| Dar cita | Pantalla propia (`/agenda/nueva-cita`) con una hoja por campo, desde el botón flotante «Nuevo» | **Un solo diálogo** desde el botón «Dar cita» de la cabecera, o haciendo clic en un hueco libre de la rejilla (rellena día, hora y columna). La hora no aparece hasta elegir servicio; «Nuevo cliente» va dentro, sin notas | Tres capas de modal seguidas no caben en un escritorio. Con un cliente sin app el aviso final dice «Cita enviada por correo»: el de la app («…tiene 10 minutos») no es cierto para un invitado. |
| Abrir en Maps | Pregunta y abre la app de mapas | Enlace directo a Google Maps en otra pestaña | No hay app de mapas que pueda faltar. |
| Cerrar días con citas dentro | El botón se apaga si hay citas afectadas (su comentario dice que el servidor lo rechazaría, pero **el servidor las cancela**: parece un fallo de la app) | Se deja cerrar: el botón se pone en rojo y pide una segunda confirmación con el número de citas que se cancelan. Si la consulta previa falla, no deja seguir | `BusinessClosureService.create` cancela y devuelve el dinero, y los textos del ARB lo dicen. **Pendiente de que el dueño decida si lo quiere igual que la app.** |
| Días libres del dueño | Con equipo, «Yo» en Ausencias; el autónomo ya no tiene dónde verlos | Igual, y además: antes de bloquear se consulta `/timeoff/conflicts` y se listan las citas que estorban; los días libres antiguos de un autónomo se ven (solo para quitarlos) al pie de «Días de cierre» | Esos días siguen bloqueando la agenda aunque la app ya no los enseñe. |
| Quitar una ausencia | Deslizar en el historial | Botón «Quitar» en cada fila, con confirmación | Sin gestos en escritorio. |
| Filtros de clientes | Botón con hoja de filtros; buscador que se despliega | Segmentado «Todos / Mis contactos / De Bipsy» y chips siempre a la vista; los vetados siguen en su pantalla | Caben, y un filtro activo que no se ve es peor. |
| Zona de desplazamiento | Hoja con mapa: se mueve el alfiler y se ve el círculo | Sin mapa: interruptor y deslizador de km dentro de «Editar tu ficha»; el centro es el punto guardado, el del local, o una dirección buscada en «Desde dónde sales». Si hay límite y no hay centro que resolver, no deja guardar | La web no tiene mapa (§5.5). Los textos de ese campo no están en el ARB. |
| Dónde se presta (servicio) | Hoja con tres opciones | Tres tarjetas dentro del formulario del servicio | Misma razón que las horas por servicio. |
| Horario propio del dueño | `owner_agenda_screen.dart` (`/profile/owner-agenda`), separado del horario del negocio cuando hay empleados | No existe todavía: «Tú y tu horario» guarda `ownerPerforms`, el nombre y la foto, pero el horario personal se edita como el del negocio | Es una pantalla entera y el horario del negocio ya está en `/panel/negocio/horario`. Pendiente en §5. |
| Cuentas vinculadas | Pantalla propia con Google, Apple (solo iOS) e Instagram | Bloque «Cuentas vinculadas» dentro de «Tu cuenta», con Google y Apple. Instagram vive donde se usa, en el portfolio | Desde que el panel pasa por Firebase Auth, el navegador obtiene el `idToken` de Apple igual que el de Google, así que `POST\|DELETE /me/link/apple` ya tiene con qué llamarse. Instagram no es una forma de entrar, es de dónde salen las fotos. |
| Eliminar un trabajador | `DELETE /workers/{id}/account`: borra la cuenta y cancela sus citas | Lo mismo, con el aviso literal de la app | Antes la web llamaba a `DELETE /workers/{id}` (solo desvincular), que la app no usa en ninguna pantalla. Dos puertas que se leen igual y hacen cosas distintas era peor que una. |
| Vista previa de la ficha | `GipsiBusinessDetailBody`, el mismo widget que la app de cliente | Dos vistas con los mismos endpoints públicos y un conmutador: **Web** (marco de navegador a 1280, 834 y 390, con el markup y el CSS copiados de `bipsy-web-app/…/business-detail` y su cromo) y **App** (port del widget compartido a tamaño real dentro de un Pixel 8 y un iPhone 15). Las `@media` de la copia pasan a `@container` para que rompan al ancho del marco y no al del panel. Las acciones del cliente avisan con un toast. No se dibujan los efectos de marca ni la fila de redes (`branding.coverEffect`/`nameEffect` y `BusinessResponse.social` no llegan al panel); sí el orden de secciones y las imágenes animadas | No hay widget compartido que reutilizar en la web, y el dueño necesita ver los dos sitios donde de verdad le miran. |

---

## 5. Lo que falta

Por orden de lo que más se va a echar en falta:

0. **Probar el cobro real de Stripe de punta a punta** con claves de test (`STRIPE_SECRET_KEY`,
   `STRIPE_PUBLISHABLE_KEY` y el webhook): contratar con prueba, contratar sin prueba (se cobra al
   confirmar), tarjeta con 3-D Secure (vuelve con `setup_intent_client_secret` en la URL), cambio de
   plan, baja y reactivación.
1. ~~**Subida de imágenes**~~ — hecho el 22/09/2026: foto de perfil y portada en «Tu ficha»
   (`POST|DELETE /businesses/me/images/profile|cover` y luego `refreshMe()`), foto de servicio
   (`POST|DELETE /services/{id}/image`; al crear, se sube justo después) y portfolio
   (`POST /businesses/me/portfolio` con `caption` y `serviceId` en el multipart:
   `Api.upload(path, file, fields)`).
2. ~~Editar normas y políticas~~ — hecho el 22/09/2026 en `negocio/normas.component.*`: catálogo
   (`/policies/catalog`, se marca y desmarca al instante), normas propias (crear, editar, mover de
   categoría, quitar), categorías propias con icono (`/businesses/me/policy-categories`) y
   reordenado de normas (`PUT …/policies/order` `{categoryId, policyIds}`) y de categorías
   (`PUT …/policy-categories/order` `{categoryIds}`) con flechas.
3. ~~**Chat en vivo** por WebSocket y adjuntos~~ — hecho el 22/09/2026 (§4, «Chat»): socket en vivo,
   ticks de enviado/entregado/leído, adjuntos (imágenes y documentos, 10 MB, los tipos de
   `PrivateMediaValidation`) descargados como blob con el token, y reintento con el mismo
   `clientMessageId`. Queda por probar contra el backend real: que el dominio de la web esté en
   `gipsi.cors.allowed-origins`, que también filtra el `Origin` del socket, o el handshake falla en
   silencio y el panel se queda en el modo de sondeo.
4. ~~**Alta de cobros** (Stripe Connect)~~ — hecho el 22/09/2026: formulario propio
   (`POST /businesses/me/payouts/activate`, `ActivatePayoutsRequest`), `issues[]` de Stripe con
   «Comprobar de nuevo» (`POST /refresh`), saldo, «Últimos cobros» paginados
   (`GET /payments?page&size`) y devoluciones (`GET …/{id}/refundable`, `GET|POST …/{id}/refunds`).
   Queda por probar contra Stripe real. Como en la app, un alta ya hecha no se reenvía (400): los
   problemas se resuelven y se vuelve a comprobar.

   **25/09/2026** — traído lo que la app añadió en cobros:
   - **Corregir los datos del titular** (`GET|PUT /businesses/me/payouts/details`). El mismo
     `app-payouts-form` con `[prefill]`: el IBAN pasa a ser opcional —Stripe no lo devuelve, así que
     vacío es «deja el que tengo», y el hueco dice «Acaba en XXXX»—, las condiciones no se vuelven a
     aceptar (ya tienen su fecha y su IP) y cambiar de banco se confirma antes. Es lo que resuelve
     el rechazo más común, una errata en el apellido o la fecha. A diferencia de la app **no tiene
     ruta propia**: vive dentro de `/panel/ajustes/cobros` como un modo con su «Atrás», y al guardar
     se vuelve ahí, que es donde se ve si ha servido.
   - **Verificación de Stripe** (`POST …/verification-link`), hasta donde llega el alta propia: una
     foto del DNI no se puede mandar por la API. Se abre en otra pestaña, y la pestaña se abre
     **dentro del clic**, antes de esperar al enlace: pedirla después del `await` la convierte en
     una emergente que Safari y Firefox bloquean sin decir nada. El enlace se pide justo antes
     porque caduca en minutos y sólo sirve una vez; la vuelta la cierra el backend con sus propias
     páginas (`/payouts/verificacion/vuelta|caducado`, públicas en `SecurityConfig`).
   - **Los dos botones cambian según haya avisos**, como en la app: con `issues[]` lo primero es
     «Enviar lo que falta» y «Revisar mis datos»; sin ellos no hay nada que hacer salvo esperar, así
     que manda «Comprobar de nuevo» y lo demás baja a texto secundario.
   **Tarjeta y pago de la cita atados a los cobros** — mismo día, con el contrato nuevo del perfil.
   `requiresCard` pasó a ser **el efectivo** (`Business#requiresCardEffective`, ya descontado que se
   pueda cobrar) y aparecieron `requiresCardIntent` —lo que el dueño eligió— y `payoutsReady`.
   Quién lee qué:
   - **El interruptor** de Funcionalidades pinta `requiresCardIntent && canCollect` y guarda
     mandando `requiresCard` (que es como se llama en `/businesses/me/settings`). Sin cobros sale
     apagado **y deshabilitado**: un interruptor encendido dice «esto ya funciona».
   - **Cancelaciones** lee `requiresCardIntent`, no el efectivo: configura SU política, y mientras
     Stripe verifica la cuenta sigue siendo la suya aunque no esté en vigor.
   - **`canCollect`** cae en `payoutsReady` del perfil mientras la cuenta carga. Sin eso el bloque
     salía apagado un segundo —lo que tarda Stripe— y luego se encendía, y quien lo tiene todo bien
     veía parpadear sus ajustes cada vez que entraba.
   - **Aviso en el shell** (`payouts_pending_banner.dart`): eligió tarjeta y todavía no puede
     cobrar. Sale de los dos campos del perfil, no de una llamada a Stripe en cada arranque, y sólo
     se puede apartar —en memoria, así que vuelve al recargar—: lo que lo quita de verdad es
     configurar los cobros. En la app, además, el paso 5 del alta enseña un aviso al terminar; en la
     web no hace falta un modal, porque al entrar al panel el banner ya lo dice y lleva al sitio.
5. ~~**Dirección con Google Places**~~ — hecho el 22/09/2026: `pn-address-search` habla con el
   proxy del backend (`GET /places/autocomplete?q&sessionToken&citiesOnly`,
   `GET /places/details?placeId&sessionToken`; mismo token de sesión hasta elegir). En la ficha se
   edita la modalidad y la dirección como `edit_business_screen.dart` (`PUT /businesses/me` y,
   si hay punto nuevo o cambia la modalidad, `PUT /businesses/me/location` con todo lo demás
   reenviado). En el paso 4 del alta, con local hay que elegir de la lista. Si el backend no tiene
   clave (503) el campo se queda en texto libre y aparecen ciudad/provincia/CP a mano. Lo que no
   hay en la web es el **mapa para afinar el pin** (`/places/reverse` sin usar): las coordenadas son
   las de Google.
6. ~~Lista de espera para trabajadores~~ **hecho (22/09/2026)**: la vista «Espera» de la agenda se
   abre al trabajador con `waitlistManageEnabled` si el negocio la tiene activa
   (`EmployerSummary.waitlistEnabled`, que sale del `GET /businesses/{id}` público porque el
   `WorkerResponse` no lo trae). Puede ver, reordenar, quitar y ofrecer huecos (los suyos si el
   cliente no pidió a nadie); el reparto (`/businesses/me/settings`) sigue siendo del dueño. La app
   aún no tiene esta pantalla: es una divergencia a favor de la web.
7. ~~**Ausencias propias** del negocio autónomo~~ — hecho el 22/09/2026:
   `/panel/ajustes/tiempo-libre` (`GET /timeoff/me`, `POST /timeoff`, `DELETE /timeoff/{id}`), solo
   visible si `autonomous`.
8. ~~**Preferencias de notificaciones**~~ — hecho el 22/09/2026: mismas claves `notif_*` que la app,
   en `localStorage` por usuario, más `notif_web_desktop` (interruptor general del navegador). Avisos
   de escritorio (`Notification`) con `DesktopNotifyService`, que no sondea: compara lo que ya leen
   los stores (agenda, bandeja, ausencias, reseñas, fichajes) y solo avisa si el panel no está
   delante. El «Recordatorio de fichaje» es solo del móvil. Mientras los stores no se relean solos,
   los avisos llegan cuando algo los recarga (el chat en vivo sí lo hace).
9. ~~**Marca Quality**~~ — **retirada el 23/09/2026**, no pendiente (§4, «Personalización»). La
   pantalla `/panel/negocio/marca` y sus cuatro endpoints ya no se llaman desde la web. Lo que
   sigue abierto, si algún día se repone el orden de la ficha: `PUT /businesses/me/branding` exige
   `BRANDING` cuando `accentColor` no es null y `UNIQUE_ANIMATIONS` cuando hay algún efecto,
   **aunque no cambien**, así que un negocio que baja de plan con color o efectos guardados recibe
   402 al guardar solo el orden (a la app le pasa igual en `SectionOrderGroup`). Se arregla en
   `BusinessBrandingService.update` comparando con lo guardado.
10. ~~**Vista previa de la ficha pública**~~ — hecho el 22/09/2026 en `/panel/negocio/vista-previa`:
    `GET /businesses/{id}`, `/services`, `/schedule`, `/portfolio`, `/policies` y
    `/reviews/business/{id}?page=0&size=3&sort=rating,desc`, con `AuthService.businessId()`.
11. ~~**Horas por servicio**~~ — hecho el 23/09/2026: «Solo a ciertas horas» en el formulario de
    servicio (`pn-service-hours`), con la rejilla de `GET /businesses/me/slot-grid` y `timeWindows`
    viajando **siempre** en `POST /services` y `PUT /services/{id}` (lista vacía = sin restricción).
12. ~~**Redes sociales de la ficha**~~ — hecho el 23/09/2026: las seis de `social_links_group.dart`
    en `PUT /businesses/me` dentro de `social`, con las seis claves siempre presentes.
13. ~~**Cancelaciones**~~ — hecho el 23/09/2026 en `/panel/ajustes/cancelaciones`, colgando de
    Funcionalidades como en la app. Deslizadores, no cajas: `cancellationFeePercent` de 0 a 50 de 5
    en 5 y `cancellationWindowHours` de 3 a 24.
14. ~~**El dueño como profesional**~~ — hecho el 23/09/2026 en `/panel/ajustes/reservas`:
    `ownerPerforms`, `ownerDisplayName` y `POST|DELETE /businesses/me/images/owner`.
15. ~~**Trabajar solo o con equipo**~~ — hecho el 23/09/2026: interruptor `teamEnabled` en
    Funcionalidades (el servidor lo rechaza con su motivo si aún hay equipo o invitaciones) y
    estado «Trabajas solo» en `/panel/equipo`, que ya no pide nada a la API en ese modo (409).
16. ~~**Importar de Instagram**~~ — hecho el 23/09/2026 en el portfolio: `GET …/instagram/status`,
    `POST …/connect-url` (se abre en otra ventana y se vuelve con «Actualizar»), `GET …/media`,
    `POST …/import` y `DELETE …/instagram`. Queda por **probarlo contra una app de Meta real**: el
    callback lo cierra el backend con su propia página, no hay deep link de vuelta.
16b. ~~**Sincronización del 05/10/2026**~~ — hecho: ver el resumen de arriba. Queda por **probar contra
    el backend real**: dar cita a un cliente con cuenta y a uno solo con correo, cerrar días con citas
    dentro, la zona de desplazamiento de un negocio solo-domicilio, y el login por correo de cuentas
    antiguas. Pendientes pequeños: la agenda no se refresca sola (una cita «Esperando al cliente»
    conserva la cuenta atrás vieja hasta recargar) y `?vista=` solo se lee al montar la agenda.
17. **Horario personal del dueño** (`owner_agenda_screen.dart`, `/profile/owner-agenda`): cuando hay
    empleados, el dueño tiene un horario propio distinto del horario del negocio. En la web todavía
    se edita solo el del negocio (§4).
18. ~~**Vincular Apple**~~ — hecho: el panel pasa por **Firebase Auth**
    (`panel/core/auth/social-auth.service.ts`), así que el navegador obtiene el `idToken` de Apple
    igual que el de Google. Entrar, darse de alta y vincular funcionan con los dos.
    **Lo que falta no es código, es configuración**: el proveedor Apple está apagado en
    `panel/core/auth/firebase.config.ts` (`appleSignInEnabled = false`) hasta que existan el
    Services ID de Apple con Return URL `https://gipsi-6806c.firebaseapp.com/__/auth/handler` y el
    proveedor activado en Firebase Console con su clave `.p8`. Con eso hecho, se enciende poniendo
    la constante a `true` aquí y en `bipsy-web-app/src/environments/firebase.config.ts`.

    ⚠️ El panel entraba antes por **Google Identity Services**, que devuelve un token de Google a
    secas: `FirebaseTokenVerifier` lo habría rechazado porque el `aud` no es el del proyecto. Ese
    camino ya no existe (`google-signin.service.ts` y `google.config.ts` borrados).

---

## 6. Contratos con el backend que conviene no volver a romper

Encontrados y corregidos el 22/09/2026 comparando cada llamada con `bipsy-backend`:

- **Horario** (`/schedules/me`, `/workers/{id}/schedule`): `dayOfWeek` va y viene **por nombre**
  («MONDAY») y las horas como «09:00:00». Todo pasa por `core/api/schedule.ts`. Mandar un número
  guardaba mal el día: Jackson lee un entero como la posición del enum (1 = martes).
- **Fichajes**: `checkInAt`/`checkOutAt` son `Instant` en UTC (con `Z`). Se leen con
  `fromInstant()`, nunca con `toDate()`, que quita la `Z` y las adelantaba dos horas.
- `/timeclock/business/history` exige `from` y `to` (`yyyy-MM-dd`); se pide mes a mes.
- Responder reseñas: el cuerpo es `{ text }`.

Añadidos el 23/09/2026:

- **`timeWindows` de un servicio**: `null` (o ausente) significa «no lo toques»; **lista vacía
  significa «quita la restricción»**. La web manda siempre la lista, nunca la omite. Las horas van
  como `HH:mm:ss` y el día **por nombre** («MONDAY»), igual que el horario.
- **`/businesses/me/slot-grid`** devuelve horas de **comienzo** de cita, no el cierre: la última hora
  a la que puede acabar una franja es `última + slotMinutes`.
- **`social` en `PUT /businesses/me`**: las **seis** claves (`website`, `instagram`, `facebook`,
  `x`, `tiktok`, `whatsapp`) viajan siempre; `''` borra una red y omitirla la deja como estaba. Se
  guarda el usuario, no la URL: el backend extrae el usuario de una dirección pegada.
- **`PUT /businesses/me/branding` es estado completo**, no un parche: mandar solo `sectionOrder`
  borraría color y efectos. Por eso, y por el 402 del punto 9 de §5, la web ya no escribe marca.
- **Eliminar un trabajador** es `DELETE /workers/{id}/account` (borra la cuenta y cancela sus
  citas). `DELETE /workers/{id}` solo desvincula y la app no lo usa en ninguna pantalla.
- **`teamEnabled = false`**: `/businesses/{id}/workers`, `/invitations/**`, `/absences/**` y el
  fichaje responden **409**. Con ese modo no se les llama.
- **Cancelaciones**: `cancellationFeePercent` ∈ [0, 50] y `cancellationWindowHours` ∈ [3, 24], con
  un tope absoluto de 100 € por cobro. Sin `requiresCard` la tarifa se guarda como 0.
- El resto (servicios, chat, cobros, espera, vetos, código, soporte, suscripción, ficha, portfolio,
  normas, alta) está en el informe de esa fecha; ante la duda, mirar el `record` del DTO en
  `bipsy-backend/src/main/java/com/gipsi/dto/**` y cómo lo llama `packages/gipsi_api`.

Añadidos el 05/10/2026:

- **`X-Bipsy-Scope: PROFESSIONAL`** en todas las llamadas (`auth.interceptor.ts`). `/auth/login`,
  `/auth/password/forgot|verify-code` y `/auth/signup/*` la **exigen** (400 sin ella): desde la V105
  un mismo correo puede tener cuenta de cliente y cuenta profesional.
- **`/auth/login` recibe `{ email, password }`**. `username` ya no existe en ningún DTO (`AuthResponse`,
  `MeResponse`, `WorkerResponse`, altas, invitación) ni hay `PUT /me/username`.
- **`PUT /businesses/me/location` reemplaza**: hay que reenviar siempre `serviceAreaLatitude`,
  `serviceAreaLongitude` y `serviceRadiusKm` o la zona se pierde. Radio 0/null = sin límite (máx. 100).
  Sin centro, el servidor usa el punto del local; un solo-domicilio sin centro guarda el radio pero
  no limita nada. Con modalidad `AT_BUSINESS` el servidor borra la zona.
- **Servicios**: `serviceMode` y `homeSurchargeCents` a null en `PUT` = «no lo toques»; en `POST` =
  hereda la modalidad del negocio y 0. Tope del recargo: 20 000 céntimos. Las pantallas del dueño leen
  `serviceModeIntent`; `serviceMode` es el que está en vigor.
- **Ajustes** (`/businesses/me/settings`): `travelBufferMinutes` (0–120) y `autoTrustEnabled`.
- **Clientes**: `GET /businesses/me/customers?q&origin=MINE|BIPSY&trusted&withBooking`;
  `withBooking=false` es un filtro de verdad y hay que mandarlo. `PUT …/{id}/trusted {trusted}` solo
  vale con cuenta de Bipsy y devuelve la ficha entera. **`trusted` solo es fiable** en el listado, el
  detalle y ese `PUT`: crear, editar e invitar responden siempre `trusted: false`.
- **`POST /businesses/me/bookings`** (`CreateBookingForCustomerRequest`, solo dueño): `businessCustomerId`
  es la ficha, no la cuenta. Con cuenta nace `AWAITING_CUSTOMER` con 10 minutos (`confirmExpiresAt`);
  solo con correo nace `CONFIRMED` y se avisa por correo; sin ninguno, o vetado, lo rechaza con su
  mensaje. `servicePlace` es obligatorio si el servicio es `BOTH`. Los huecos salen de
  `GET /services/{id}/availability?date&workerId` (horas `HH:mm:ss`).
- **`AWAITING_CUSTOMER`** no se puede confirmar ni reprogramar desde el negocio; sí cancelar y reasignar.
  `confirmExpiresAt` y `guestConfirmedAt` son `Instant`: `fromInstant()`.
- **Invitados**: `customerId` llega a **null**. Nada que necesite cuenta (chat, veto, cobro).
- **`POST /businesses/me/closures` cancela, no rechaza**: todas las citas vivas del rango, de todos los
  profesionales, con devolución. No hay forma de decirle «solo las que vi» en `/affected`.
- **`POST /timeoff` y `POST /absences/direct` responden 400** si chocan con citas vivas.
  `/timeoff/**` no está bajo el 409 de equipo, pero da 403 si `ownerPerforms` es falso.
- **`DELETE /absences/{id}`**: el negocio borra en cualquier estado; el trabajador, solo `PENDING`.
- **`GET /businesses/{id}/workers` incluye al dueño** (id = id del negocio) cuando `ownerPerforms`, y
  **no** responde 409 en modo «trabajo solo» (lo dicho arriba el 23/09 no era exacto para esta ruta).
  `TeamStore.staff()` es el equipo sin él; `all()` lo conserva para la agenda y los servicios.

## 7. Avisos que vienen de antes

- **`TRIAL_DAYS`** (`src/app/data/site.data.ts`) vale ya **14**, la prueba del plan en el backend
  (`plan.trial_days = 14`, V37); `WELCOME_DAYS = 5` es la cortesía de `Business.WELCOME_TRIAL_DAYS`
  al terminar el alta. Se corrigieron también los «30 días» escritos a mano en `index.html`, inicio,
  «Por qué», funcionalidades, `cta-band` y páginas por oficio. Falta que las ofertas de Play y App
  Store digan lo mismo (y `PromoBarComponent.trialLabel` en bipsy-web-app).
- **Alta**: los negocios verifican el correo por **enlace**, no por código. `RegisterBusinessRequest`
  no acepta `signupToken` (el código de seis cifras de `/auth/signup/*-code` es del alta de
  cliente), así que la web sigue el orden de la app: correo (`email-status`, con «retomar» si hay
  un alta a medias) → datos del negocio (crea la cuenta; `categoryId` obligatorio) → verificar
  (`/auth/resend-verification` y «Ya lo verifiqué» contra `/me`) → ubicación → configuración.
- **Horario**: `ReplaceScheduleRequest.entries` es `@NotEmpty`; con todos los días cerrados la web
  no llama y dice «Abre al menos un día.», como `schedule_editor_screen.dart`.
- **Reseñas**: no hay endpoint de estadísticas para el dueño; `ReviewsStore` lee todas las páginas
  (`size=100`) para que media, recuento y barras sean de verdad, y la lista pinta de 20 en 20.
- **CORS**: el dominio de esta web tiene que entrar en `CORS_ALLOWED_ORIGINS` del backend antes de
  salir de local.
- Las ilustraciones de Mr. Bip que faltan están listadas en la raíz del proyecto; el panel usa
  **MB-05** (login, unirse, invitación), **MB-03** (alta), **MB-08** (recuperar contraseña) y, en la
  cabecera del inicio, el Bip del oficio del negocio (`ui/bip-negocio.component.ts`, animado si hay
  rig). Los renders son de cuerpo entero: se enseñan de medio cuerpo asomando por el borde de la
  tarjeta (`ui/desk-hero.component.ts`), nunca en miniatura.

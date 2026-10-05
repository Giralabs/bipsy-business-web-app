/**
 * Reading contacts in the browser, for `/panel/clientes/importar`.
 *
 * Two ways in, no typing:
 *
 *  1. The phone's own address book, through the Contact Picker API. Only
 *     Chrome on Android has it, and only over https, so it is feature
 *     detected and the button hides when it is not there.
 *  2. A file: a vCard export (`.vcf`) or a CSV out of Google Contacts,
 *     Outlook or whatever program the shop used before.
 *
 * Nothing leaves the browser here: the file is parsed in memory and only the
 * rows the owner keeps are posted to `/businesses/me/customers/import`.
 */

/** A contact read from a phone or a file, before the review step. */
export interface RawContact {
  name: string;
  phone: string | null;
  email: string | null;
}

/** What a parsed file gave: the usable contacts and what was thrown away. */
export interface ParsedFile {
  contacts: RawContact[];
  /** Entries with a name but no phone and no e-mail — unreachable, so dropped. */
  dropped: number;
}

/** `ImportedContact` in the backend: name 120, phone 30, e-mail 180. */
const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_EMAIL = 180;

// ----- ADDRESS BOOK (Contact Picker API) --------------------

interface ContactInfoLike {
  name?: string[];
  tel?: string[];
  email?: string[];
}

interface ContactsManagerLike {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfoLike[]>;
  getProperties?(): Promise<string[]>;
}

function contactsManager(): ContactsManagerLike | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const manager = (navigator as Navigator & { contacts?: ContactsManagerLike }).contacts;
  return manager && typeof manager.select === 'function' ? manager : null;
}

/** True only where the browser can really open the phone's address book. */
export function addressBookAvailable(): boolean {
  return contactsManager() !== null;
}

/**
 * Opens the system contact sheet and returns what was ticked there.
 *
 * The picker is the permission: there is nothing to ask for beforehand and no
 * way to read anything the person did not choose. An empty array means the
 * sheet was dismissed.
 */
export async function pickFromAddressBook(): Promise<RawContact[]> {
  const manager = contactsManager();
  if (!manager) return [];

  // Chrome does not support the same properties on every device; asking for
  // one it does not have throws instead of ignoring it.
  const supported = manager.getProperties ? await manager.getProperties() : ['name', 'tel', 'email'];
  const wanted = ['name', 'tel', 'email'].filter((property) => supported.includes(property));
  if (!wanted.includes('name')) return [];

  const picked = await manager.select(wanted, { multiple: true });
  return picked
    .map((contact) =>
      toContact(contact.name?.[0] ?? '', contact.tel?.[0] ?? null, contact.email?.[0] ?? null),
    )
    .filter((contact): contact is RawContact => contact !== null);
}

// ----- FILES --------------------

/** Extensions offered in the file dialog and accepted on a drop. */
export const CONTACT_FILE_ACCEPT = '.vcf,.vcard,.csv,.txt,text/vcard,text/csv';

export function looksLikeContactFile(file: File): boolean {
  return /\.(vcf|vcard|csv|txt|tsv)$/i.test(file.name);
}

/**
 * Reads the file as text.
 *
 * Exports from old programs are often Windows-1252, not UTF-8: decoding those
 * bytes as UTF-8 turns every accent into a replacement character. So it is
 * decoded strictly first and re-read as Windows-1252 when that fails, which
 * is what an `Ana Bermúdez` from a 2009 export needs.
 */
export async function readContactFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Picks the parser by what the text actually is, not by the extension. */
export function parseContacts(text: string): ParsedFile {
  const clean = text.replace(/^﻿/, '');
  const rows = /BEGIN:VCARD/i.test(clean) ? readVCard(clean) : readCsv(clean);

  const contacts: RawContact[] = [];
  let dropped = 0;
  for (const row of rows) {
    const contact = toContact(row.name, row.phone, row.email);
    if (contact) contacts.push(contact);
    else if (row.name.trim()) dropped++;
  }
  return { contacts, dropped };
}

// ----- vCARD --------------------

/**
 * vCard 2.1, 3.0 and 4.0 in one pass.
 *
 * Only FN, N, ORG, TEL and EMAIL are read: the rest of a card (photos,
 * addresses, notes) is not imported, and a photo is the big part of the file.
 */
function readVCard(text: string): RawContact[] {
  const out: RawContact[] = [];
  let card: RawContact | null = null;
  let structuredName = '';
  let organisation = '';

  const finish = (): void => {
    if (!card) return;
    if (!card.name) card.name = structuredName || organisation;
    out.push(card);
    card = null;
    structuredName = '';
    organisation = '';
  };

  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VCARD')) {
      finish();
      card = { name: '', phone: null, email: null };
      continue;
    }
    if (upper.startsWith('END:VCARD')) {
      finish();
      continue;
    }
    if (!card) continue;

    const property = splitProperty(line);
    if (!property) continue;
    const value = decodeValue(property.value, property.params);

    switch (property.name) {
      case 'FN':
        card.name = unescapeText(value);
        break;
      case 'N':
        // Apellido;Nombre;Segundo;Tratamiento;Sufijo — the shop reads names
        // the way it says them, so it is rebuilt as "Nombre Apellido".
        structuredName = joinName(splitEscaped(value, ';').map(unescapeText));
        break;
      case 'ORG':
        organisation = unescapeText(splitEscaped(value, ';')[0] ?? '');
        break;
      case 'TEL':
        // vCard 4.0 writes `TEL:tel:+34600102030`.
        if (!card.phone) card.phone = unescapeText(value).replace(/^tel:/i, '');
        break;
      case 'EMAIL':
        if (!card.email) card.email = unescapeText(value).replace(/^mailto:/i, '');
        break;
      default:
        break;
    }
  }
  // A file cut short still gives up the card it was in the middle of.
  finish();
  return out;
}

/**
 * Joins the folded lines of a vCard.
 *
 * Two kinds of fold: the standard one, where a continuation starts with a
 * space, and the quoted-printable one of vCard 2.1, where the line before
 * ends with `=`. Outlook and old Nokia exports use the second for any name
 * with an accent in it.
 */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const last = out.length - 1;
    if (last >= 0 && (line.startsWith(' ') || line.startsWith('\t'))) {
      out[last] += line.slice(1);
      continue;
    }
    if (last >= 0 && out[last].endsWith('=') && /quoted-printable/i.test(out[last])) {
      out[last] = out[last].slice(0, -1) + line;
      continue;
    }
    out.push(line);
  }
  return out;
}

interface VCardProperty {
  name: string;
  params: string[];
  value: string;
}

function splitProperty(line: string): VCardProperty | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const parts = line.slice(0, colon).split(';');
  // Grouped properties come as `item1.TEL`.
  const name = (parts[0] ?? '').split('.').pop()?.trim().toUpperCase() ?? '';
  if (!name) return null;
  return { name, params: parts.slice(1), value: line.slice(colon + 1) };
}

function paramValue(params: string[], key: string): string | null {
  for (const param of params) {
    const [rawKey, rawValue] = param.split('=');
    if (rawValue !== undefined && rawKey.trim().toUpperCase() === key) return rawValue.trim();
  }
  return null;
}

/**
 * Undoes the encoding a value declares. vCard 2.1 allows the bare parameter
 * (`;QUOTED-PRINTABLE:`) as well as `;ENCODING=QUOTED-PRINTABLE:`.
 */
function decodeValue(value: string, params: string[]): string {
  const declared = (paramValue(params, 'ENCODING') ?? '').toUpperCase();
  const bare = params.map((param) => param.trim().toUpperCase());
  const charset = paramValue(params, 'CHARSET') ?? 'utf-8';

  if (declared === 'QUOTED-PRINTABLE' || bare.includes('QUOTED-PRINTABLE')) {
    return decodeQuotedPrintable(value, charset);
  }
  if (declared === 'B' || declared === 'BASE64' || bare.includes('BASE64')) {
    return decodeBase64(value, charset);
  }
  return value;
}

function decodeQuotedPrintable(value: string, charset: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '=' && /^[0-9a-f]{2}$/i.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(char.charCodeAt(0) & 0xff);
    }
  }
  return decodeBytes(Uint8Array.from(bytes), charset);
}

function decodeBase64(value: string, charset: string): string {
  try {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return decodeBytes(bytes, charset);
  } catch {
    return value;
  }
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Splits on a separator that a backslash can escape. */
function splitEscaped(value: string, separator: string): string[] {
  const out: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\' && i + 1 < value.length) {
      current += char + value[i + 1];
      i++;
      continue;
    }
    if (char === separator) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\([,;:\\])/g, '$1');
}

/** `N` order is family;given;middle;prefix;suffix. */
function joinName(parts: string[]): string {
  const [family = '', given = '', middle = '', prefix = '', suffix = ''] = parts;
  return [prefix, given, middle, family, suffix]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

// ----- CSV --------------------

/** Where each piece of a contact sits in a row with headers. */
interface ColumnMap {
  full: number;
  first: number;
  middle: number;
  last: number;
  phone: number;
  email: number;
}

function readCsv(text: string): RawContact[] {
  const rows = splitRows(text, detectDelimiter(text));
  if (rows.length === 0) return [];

  const columns = mapColumns(rows[0]);
  const body = columns ? rows.slice(1) : rows;

  const out: RawContact[] = [];
  for (const row of body) {
    // Even with a header, a row can be a stray line with the fields in some
    // other order; reading it loosely is better than losing it.
    const contact = (columns ? fromColumns(row, columns) : null) ?? fromLooseRow(row);
    if (contact) out.push(contact);
  }
  return out;
}

/** The delimiter is whichever candidate appears most outside quotes. */
function detectDelimiter(text: string): string {
  const sample = text.slice(0, 8000);
  let best = ',';
  let bestCount = 0;
  for (const candidate of [',', ';', '\t', '|']) {
    const count = countOutsideQuotes(sample, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function countOutsideQuotes(text: string, char: string): number {
  let quoted = false;
  let count = 0;
  for (const current of text) {
    if (current === '"') quoted = !quoted;
    else if (!quoted && current === char) count++;
  }
  return count;
}

/** RFC 4180 rows: quoted fields, doubled quotes and newlines inside them. */
function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }
  endRow();
  return rows;
}

/** Lower case, no accents, no double spaces — `Teléfono` and `telefono` are one. */
function normalise(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const FULL_NAME_HEADERS = [
  'name',
  'full name',
  'display name',
  'contact name',
  'nombre completo',
  'nombre y apellidos',
  'nombre para mostrar',
  'contacto',
  'cliente',
];
const FIRST_NAME_HEADERS = ['first name', 'given name', 'nombre', 'nombres', 'nombre de pila'];
const MIDDLE_NAME_HEADERS = ['middle name', 'segundo nombre'];
const LAST_NAME_HEADERS = [
  'last name',
  'family name',
  'surname',
  'apellido',
  'apellidos',
  'apellido paterno',
];

/**
 * Reads the first row as headers, or decides it is not one.
 *
 * `Nombre` is the trap: on its own it is the whole name, but next to
 * `Apellidos` (the Spanish Outlook export) it is only the first name.
 */
function mapColumns(header: string[]): ColumnMap | null {
  // A row carrying an e-mail or a phone number is data, not a header.
  if (header.some((cell) => isEmailish(cell) || isPhoneish(cell))) return null;

  const names = header.map(normalise);
  const last = names.findIndex((name) => LAST_NAME_HEADERS.includes(name));
  const columns: ColumnMap = {
    full: names.findIndex(
      (name) => FULL_NAME_HEADERS.includes(name) || (isBareNombre(name) && last < 0),
    ),
    first: names.findIndex(
      (name) => FIRST_NAME_HEADERS.includes(name) && (!isBareNombre(name) || last >= 0),
    ),
    middle: names.findIndex((name) => MIDDLE_NAME_HEADERS.includes(name)),
    last,
    phone: bestColumn(names, phoneScore),
    email: bestColumn(names, emailScore),
  };

  const hasName = columns.full >= 0 || columns.first >= 0 || columns.last >= 0;
  return hasName && (columns.phone >= 0 || columns.email >= 0) ? columns : null;
}

function isBareNombre(name: string): boolean {
  return name === 'nombre' || name === 'nombres';
}

function bestColumn(names: string[], score: (name: string) => number): number {
  let best = -1;
  let bestScore = 0;
  names.forEach((name, index) => {
    const value = score(name);
    if (value > bestScore) {
      best = index;
      bestScore = value;
    }
  });
  return best;
}

/**
 * Google writes `Phone 1 - Value` next to `Phone 1 - Type`, Outlook writes
 * `Mobile Phone` next to `Business Fax`. The mobile wins, the type columns
 * and the fax never do.
 */
function phoneScore(name: string): number {
  if (/\b(type|tipo|label|etiqueta)\b/.test(name) || /fax/.test(name)) return 0;
  if (!/(phone|telefono|tel\b|movil|mobile|cell|numero|whatsapp)/.test(name)) return 0;
  let score = 1;
  if (/(movil|mobile|cell)/.test(name)) score += 4;
  if (/\b1\b/.test(name)) score += 2;
  if (/value|valor/.test(name)) score += 1;
  if (/(work|business|trabajo|oficina|home|casa|fijo)/.test(name)) score -= 1;
  return Math.max(score, 1);
}

function emailScore(name: string): number {
  if (/\b(type|tipo|label|etiqueta)\b/.test(name)) return 0;
  if (!/(mail|correo)/.test(name)) return 0;
  let score = 1;
  if (/\b1\b/.test(name)) score += 2;
  if (/value|valor|address|direccion/.test(name)) score += 1;
  return score;
}

function fromColumns(row: string[], columns: ColumnMap): RawContact | null {
  const cell = (index: number): string => (index >= 0 ? firstValue(row[index] ?? '') : '');
  const name =
    cell(columns.full) ||
    [cell(columns.first), cell(columns.middle), cell(columns.last)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

  if (!name.trim()) return null;
  return { name, phone: cell(columns.phone) || null, email: cell(columns.email) || null };
}

/** A row with no usable header: the shape of each value says what it is. */
function fromLooseRow(row: string[]): RawContact | null {
  const values = row.map((value) => firstValue(value).trim()).filter(Boolean);
  const email = values.find(isEmailish) ?? null;
  const phone = values.find((value) => value !== email && isPhoneish(value)) ?? null;
  const name = values.find((value) => value !== email && value !== phone) ?? '';
  return name ? { name, phone, email } : null;
}

/** Google packs several values into one cell separated by ` ::: `. */
function firstValue(cell: string): string {
  return (cell.split(':::')[0] ?? '').trim();
}

function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function isPhoneish(value: string): boolean {
  const trimmed = value.trim();
  return /^[+()\d\s./-]+$/.test(trimmed) && (trimmed.match(/\d/g) ?? []).length >= 6;
}

// ----- NORMALISING --------------------

/**
 * Trims a contact to what the endpoint takes, or drops it.
 *
 * Same rule as the app: no name, or neither phone nor e-mail, and there is no
 * customer to make — nobody to write to and nothing to match a Bipsy account
 * against.
 */
export function toContact(name: string, phone: string | null, email: string | null): RawContact | null {
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!cleanName) return null;

  const cleanPhone = tidyPhone(phone);
  const cleanEmail = tidyEmail(email);
  if (!cleanPhone && !cleanEmail) return null;
  return { name: cleanName, phone: cleanPhone, email: cleanEmail };
}

function tidyPhone(phone: string | null): string | null {
  const trimmed = (phone ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed || (trimmed.match(/\d/g) ?? []).length < 4) return null;
  if (trimmed.length <= MAX_PHONE) return trimmed;
  // Over the 30 the column takes: squeeze it before giving up on it.
  const tight = trimmed.replace(/[^\d+]/g, '');
  return tight.length <= MAX_PHONE ? tight : null;
}

function tidyEmail(email: string | null): string | null {
  const trimmed = (email ?? '').trim().toLowerCase();
  if (!trimmed || !isEmailish(trimmed) || trimmed.length > MAX_EMAIL) return null;
  return trimmed;
}

/** What two contacts have to share to be the same person. */
export function contactKey(contact: { phone: string | null; email: string | null; name: string }): string {
  if (contact.phone) return 'p:' + contact.phone.replace(/[^\d]/g, '').slice(-9);
  if (contact.email) return 'e:' + contact.email.toLowerCase();
  return 'n:' + contact.name.toLowerCase();
}

/**
 * PrivacyFilter fixtures (Prompt Maestro §8).
 * Run: npx tsx packages/shared/scripts/assert-privacy.mts
 */
import {
  REDACTED,
  filterFieldValue,
  isSensitiveField,
  sanitizeTutorialText,
} from '../src/privacy.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  isSensitiveField({ inputType: 'password', name: 'pwd' }),
  'password type'
);
assert(
  isSensitiveField({ placeholder: 'Contraseña' }),
  'contraseña placeholder'
);
assert(
  isSensitiveField({ name: 'cardNumber', label: 'Tarjeta' }),
  'card field'
);
assert(!isSensitiveField({ name: 'username', placeholder: 'Usuario' }), 'username ok');

const pwd = filterFieldValue('super-secret', { inputType: 'password' });
assert(pwd.sensitive && pwd.value === REDACTED, 'password redacted');

const email = filterFieldValue('user@example.com', { name: 'email' }, { redactEmail: true });
assert(email.value.includes(REDACTED) || email.value === REDACTED, 'email scrubbed');

const phoneOff = filterFieldValue('912345678', { name: 'notes' }, { redactPhone: false });
assert(phoneOff.value === '912345678' || !phoneOff.sensitive, 'phone optional');

const rut = sanitizeTutorialText('El RUT es 12.345.678-5 para el socio');
assert(rut.includes(REDACTED), `rut should redact: ${rut}`);

const card = sanitizeTutorialText('Pago con 4111 1111 1111 1111');
assert(card.includes(REDACTED), `card should redact: ${card}`);

const oauth = sanitizeTutorialText('client_secret=abc123token');
assert(/\[redacted\]/i.test(oauth), `oauth param: ${oauth}`);

console.log('assert-privacy: OK');

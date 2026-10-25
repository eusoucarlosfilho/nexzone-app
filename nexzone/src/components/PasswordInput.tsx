'use client';
import { useState, type ChangeEventHandler, type KeyboardEventHandler } from 'react';
import Icon from './Icon';

type Props = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: 'current-password' | 'new-password' | string;
  name?: string;
  id?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/** Campo de senha com botão mostrar/ocultar. Funciona dentro do wrapper `.fg`. */
export default function PasswordInput({ placeholder = '••••••••', autoComplete = 'current-password', ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input {...rest} type={show ? 'text' : 'password'} placeholder={placeholder} autoComplete={autoComplete}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="pw-btn" onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show} title={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-controls={rest.id}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
      </button>
    </div>
  );
}

/** Dica visual de força: mín. 8 caracteres; letras e números. Não bloqueia nada. */
export function PasswordHint({ value, id }: { value: string; id?: string }) {
  const len = value.length >= 8;
  const mix = /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value);
  return (
    <div className="pw-hint" id={id} aria-live="polite">
      <span className={len ? 'ok' : ''}><Icon name={len ? 'checkCircle' : 'info'} size={14} />Mín. 8 caracteres</span>
      <span className={mix ? 'ok' : ''}><Icon name={mix ? 'checkCircle' : 'info'} size={14} />Letras e números</span>
    </div>
  );
}

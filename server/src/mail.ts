import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  )
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<'sent' | 'console'> {
  const appName = process.env.APP_NAME ?? 'Loomi'
  const from = process.env.SMTP_FROM ?? `${appName} <noreply@localhost>`
  const subject = `${appName}: код для сброса пароля`
  const text = `Вы запросили сброс пароля в ${appName}.

1. Откройте приложение Loomi
2. Профиль → Войти → «Забыли пароль?»
3. Введите email и этот код:

${code}

Код действует 1 час. Если вы не запрашивали сброс — проигнорируйте письмо.`

  if (!isSmtpConfigured()) {
    console.log(
      `[mail] Сброс пароля для ${to}\n  Код (введите в приложении): ${code}\n  Настройте SMTP_* в server/.env для отправки на почту.`,
    )
    return 'console'
  }

  await createTransporter().sendMail({ from, to, subject, text })
  return 'sent'
}

export async function verifySmtpOnStartup(): Promise<void> {
  if (!isSmtpConfigured()) return
  try {
    await createTransporter().verify()
    console.log('[loomi-api] почта: SMTP проверен, письма будут уходить на email')
  } catch (err) {
    console.error(
      '[loomi-api] почта: SMTP настроен, но подключение не удалось — проверьте SMTP_* в server/.env',
    )
    console.error(err)
  }
}

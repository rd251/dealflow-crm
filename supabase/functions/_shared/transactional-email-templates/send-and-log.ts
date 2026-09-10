import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailOptions,
  type SendTemplateEmailResult,
} from './send-email.ts'

// Sends a registered template through Lovable's managed email API and keeps the
// project's own email_send_log audit trail up to date.
export async function sendTemplateEmailWithLog(
  templateName: string,
  recipientEmail: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const log = async (status: string, errorMessage?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipientEmail,
      status,
      error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
        template_name: templateName,
        status,
      })
    }
  }

  try {
    const result = await sendTemplateEmail(templateName, recipientEmail, options)
    if (result.sent) {
      await log('sent')
    } else {
      await log('suppressed')
    }
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('failed', message)
    throw error
  }
}

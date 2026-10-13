import * as React from 'npm:react@18.3.1'
import { ROBIN_GMAIL_SIGNATURE_HTML } from './robin-signature.ts'

/** Renders Robin's exact Gmail signature inside React Email templates. */
export function RobinSignatureEmail() {
  return (
    <div
      data-snakk-signature="robin"
      style={{ marginTop: '24px', textAlign: 'left' }}
      dangerouslySetInnerHTML={{ __html: ROBIN_GMAIL_SIGNATURE_HTML }}
    />
  )
}

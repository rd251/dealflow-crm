import * as React from 'npm:react@18.3.1'
import { Section, Row, Column, Text, Link } from 'npm:@react-email/components@0.0.22'
import { ROBIN_SIGNATURE as s, SIGNATURE_COLORS as c } from './robin-signature.ts'

const link = { color: c.text, textDecoration: 'underline' }
const text = { margin: '0', fontSize: '12px', lineHeight: '22px', color: c.text }

export function RobinSignatureEmail() {
  return (
    <Section data-snakk-signature="robin" style={{ margin: '24px 0 8px', maxWidth: '440px', backgroundColor: c.background, fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'left' }}>
      <Row>
        <Column style={{ verticalAlign: 'top', padding: '8px 16px 8px 0', borderRight: `1px solid ${c.accent}`, width: '43%' }}>
          <Text style={{ ...text, fontSize: '15px', fontWeight: 700 }}>{s.navn}</Text>
          <Text style={text}>{s.tittel}</Text>
          <Text style={text}>{s.selskap}</Text>
        </Column>
        <Column style={{ verticalAlign: 'top', padding: '4px 0 4px 16px' }}>
          <Text style={text}><span style={{ color: c.accent }}>☎</span> &nbsp;<Link href="tel:+4793438816" style={link}>{s.telefon}</Link></Text>
          <Text style={text}><span style={{ color: c.accent }}>✉</span> &nbsp;<Link href={`mailto:${s.epost}`} style={link}>{s.epost}</Link></Text>
          <Text style={text}><span style={{ color: c.accent }}>◎</span> &nbsp;<Link href={`https://${s.nettsted}`} style={link}>{s.nettsted}</Link></Text>
          <Text style={text}><span style={{ color: c.accent }}>⚲</span> &nbsp;{s.adresse}</Text>
        </Column>
      </Row>
    </Section>
  )
}
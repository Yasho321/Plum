/**
 * OWNER    : Khare
 * DUE      : D3 optional
 * TASK     :
 *   Backup channel: SES sandbox email to verified addresses with attachments.
 * DONE WHEN: -
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

export async function sendEmailWithAttachment(toAddress, subject, bodyText, attachmentBuffer, filename) {
  const isMock = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
  if (isMock) {
    console.log(`[SES Mock] To: ${toAddress}, Subject: ${subject}, Attachment: ${filename}`);
    return;
  }
  
  const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
  
  // Construct raw email with MIME attachments (simplified for demo)
  const boundary = "NextPart_" + Math.random().toString(16).substring(2);
  const fromAddress = process.env.SES_FROM_ADDRESS || 'alert@plumetrace.demo';
  
  const rawMessage = [
    `From: ${fromAddress}`,
    `To: ${toAddress}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    bodyText,
    '',
    `--${boundary}`,
    `Content-Type: application/octet-stream; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    attachmentBuffer.toString('base64'),
    '',
    `--${boundary}--`
  ].join('\r\n');
  
  try {
    const cmd = new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawMessage) }
    });
    await ses.send(cmd);
    console.log(`SES email sent to ${toAddress}`);
  } catch (err) {
    console.error('SES email failed:', err);
    throw err;
  }
}

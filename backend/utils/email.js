import nodemailer from 'nodemailer';
import logger from './logger.js';
import { getSystemSettings, serializeSystemSettings } from './systemSettings.js';

const normalizeSmtpPassword = (host, password) => {
  const trimmedPassword = password?.trim();
  if (!trimmedPassword) return trimmedPassword;

  const normalizedHost = host?.trim().toLowerCase();
  const isGoogleSmtp = normalizedHost === 'smtp.gmail.com' || normalizedHost === 'smtp.googlemail.com';

  return isGoogleSmtp ? trimmedPassword.replace(/\s+/g, '') : trimmedPassword;
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: normalizeSmtpPassword(host, process.env.SMTP_PASS),
    },
  };
};

const createTransporter = () => nodemailer.createTransport(getSmtpConfig());

const getFallbackFromAddress = (businessName = 'Liquor POS') => {
  const customFrom = process.env.MAIL_FROM?.trim();
  if (customFrom) {
    const customAddressMatch = customFrom.match(/<([^>]+)>/);
    if (customAddressMatch?.[1]) {
      return `"${businessName} Admin" <${customAddressMatch[1].trim()}>`;
    }

    if (customFrom.includes('@')) {
      return `"${businessName} Admin" <${customFrom}>`;
    }

    return customFrom;
  }

  const smtpUser = process.env.SMTP_USER?.trim();
  return smtpUser ? `"${businessName} Admin" <${smtpUser}>` : undefined;
};

const getEmailBranding = async () => {
  try {
    const settings = serializeSystemSettings(await getSystemSettings());
    const businessName = settings.business_name?.trim() || 'Liquor POS';

    return {
      businessName,
      from: getFallbackFromAddress(businessName),
    };
  } catch (error) {
    logger.warn('Failed to load system settings for email branding. Falling back to default brand.');
    return {
      businessName: 'Liquor POS',
      from: getFallbackFromAddress(),
    };
  }
};

const hasSmtpCredentials = () => {
  const { auth } = getSmtpConfig();
  return Boolean(auth.user && auth.pass);
};

const isGoogleSmtpHost = (host = process.env.SMTP_HOST) => {
  const normalizedHost = host?.trim().toLowerCase();
  return normalizedHost === 'smtp.gmail.com' || normalizedHost === 'smtp.googlemail.com';
};

const getEmailErrorMessage = (error) => {
  if (error?.code === 'EAUTH' && isGoogleSmtpHost()) {
    return 'Email not sent: Gmail SMTP rejected the login. Use the Gmail address in SMTP_USER and a 16-character Google App Password in SMTP_PASS, then share the temporary password manually for now.';
  }

  return error?.message || 'Email could not be sent';
};

const buildRegistrationEmailHtml = ({ username, role, loginLink, businessName }) => `
  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
    <h2 style="color: #6366f1;">Welcome to ${businessName}!</h2>
    <p>Hi <b>${username}</b>,</p>
    <p>Your account has been registered successfully as <b>${role.toUpperCase()}</b>.</p>
    <p>You can now sign in using the button below.</p>

    <a href="${loginLink}" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Open ${businessName}</a>

    <p style="margin-top: 30px; font-size: 12px; color: #9ca3af;">If you did not create this account, please contact an administrator immediately.</p>
  </div>
`;

const sendEmail = async ({ to, from, subject, html, mockMessage }) => {
  try {
    if (!hasSmtpCredentials()) {
      logger.warn('SMTP credentials missing from .env. Mocking email send in development.');
      logger.info(`[MOCK EMAIL TO ${to}]: ${mockMessage}`);
      return { success: true, mocked: true, message: 'SMTP credentials missing, using dev mock log' };
    }

    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to} [ID: ${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (error?.code === 'EAUTH' && isGoogleSmtpHost()) {
      logger.error('Gmail SMTP authentication failed. Use the Gmail address as SMTP_USER and a 16-character Google App Password as SMTP_PASS.');
    }

    logger.error('Failed to send email:', error);
    return {
      success: false,
      error: getEmailErrorMessage(error),
      manualShareNeeded: true,
    };
  }
};

export const sendRegistrationEmail = async (toEmail, username, role, loginLink) => {
  const { businessName, from } = await getEmailBranding();

  return sendEmail({
    to: toEmail,
    from,
    subject: `Your ${businessName} account is ready`,
    html: buildRegistrationEmailHtml({ username, role, loginLink, businessName }),
    mockMessage: `Your ${businessName} account has been registered. Login here: ${loginLink}`,
  });
};

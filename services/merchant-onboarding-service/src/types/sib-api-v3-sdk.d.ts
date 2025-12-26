declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: any;
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(sendSmtpEmail: SendSmtpEmail): Promise<any>;
  }

  export class SendSmtpEmail {
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    sender?: { name: string; email: string };
    to?: Array<{ email: string; name?: string }>;
  }
}


import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user: {
      sub: string;
      email: string;
      first_name: string;
      last_name: string;
    };
  }
}

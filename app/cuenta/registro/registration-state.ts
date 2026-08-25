export type CustomerRegistrationState = Readonly<{
  error?: string;
  success?: string;
  authenticated?: boolean;
}>;
export const initialCustomerRegistrationState: CustomerRegistrationState = {};

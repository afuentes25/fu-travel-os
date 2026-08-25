export type CustomerLoginState = Readonly<{
  error?: string;
  authenticated?: boolean;
}>;

export const initialCustomerLoginState: CustomerLoginState = {};

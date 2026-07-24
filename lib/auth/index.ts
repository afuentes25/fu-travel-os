export const demoRoles = ["platform_owner","platform_admin","agency_owner","agency_admin","manager","sales_agent","operator","coordinator","accountant"] as const;
export type DemoRole=(typeof demoRoles)[number];
export type DemoSession={role:DemoRole;agencyId?:string;demo:true};
export function canPreviewRole(role:string):role is DemoRole{return demoRoles.includes(role as DemoRole)}

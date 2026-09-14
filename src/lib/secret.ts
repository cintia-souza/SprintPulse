const DEV_SECRET = "sprintpulse-dev-secret-change-me";
const RAW_SECRET = process.env.JWT_SECRET;

// Falha fechado: sem segredo em produção qualquer um forja uma sessão — e é a
// sessão que decide de quem é cada card.
if (process.env.NODE_ENV === "production" && !RAW_SECRET) {
  throw new Error("JWT_SECRET é obrigatório em produção");
}

export const APP_SECRET = RAW_SECRET || DEV_SECRET;

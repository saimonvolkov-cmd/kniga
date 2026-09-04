"use strict";
/* Health-чек: подтверждает, что функция задеплоена и отвечает.
   Без обращений к внешним API. Точка входа: health.handler */
const { configured, isPreflight, preflightResponse, ok } = require("./lib");

exports.handler = async (event) => {
  if (isPreflight(event)) return preflightResponse();
  // Сообщаем, заданы ли ключи (булево, без самих значений) — удобно для отладки,
  // но никаких секретов наружу не уходит.
  return ok({ ok: true, configured: configured(), service: "kniga-health" });
};

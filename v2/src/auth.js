import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
const scrypt=promisify(scryptCallback);
const KEY_BYTES=64;
const TOKEN_TTL_SECONDS=60*60*24*7;

export function normalizeEmail(value) {
  return typeof value==="string" ? value.trim().toLowerCase() : "";
}
export function validateRegistration(input) {
  const username=typeof input?.username==="string"?input.username.trim():"";
  const email=normalizeEmail(input?.email);
  const password=typeof input?.password==="string"?input.password:"";
  if(username.length<3||username.length>24||! /^[\p{L}\p{N}_ -]+$/u.test(username)) return "Oyuncu adı 3-24 karakter olmalı; harf, rakam, boşluk, _ ve - kullanılabilir.";
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Geçerli bir e-posta adresi gir.";
  if(password.length<10||password.length>128) return "Şifre 10-128 karakter arasında olmalı.";
  return null;
}
export async function hashPassword(password) {
  const salt=randomBytes(16);
  const derived=await scrypt(password,salt,KEY_BYTES);
  return `scrypt:${salt.toString("base64url")}:${Buffer.from(derived).toString("base64url")}`;
}
export async function verifyPassword(password,stored) {
  const [scheme,saltText,keyText]=String(stored||"").split(":");
  if(scheme!=="scrypt"||!saltText||!keyText)return false;
  try{
    const expected=Buffer.from(keyText,"base64url");
    const actual=Buffer.from(await scrypt(password,Buffer.from(saltText,"base64url"),expected.length));
    return expected.length===actual.length&&timingSafeEqual(expected,actual);
  }catch{return false;}
}
export function createSessionToken(userId,secret,now=Date.now()) {
  if(!secret||secret.length<32)throw new Error("SESSION_SECRET en az 32 karakter olmalı.");
  const payload=Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(now/1000)+TOKEN_TTL_SECONDS})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return payload+"."+signature;
}
export function verifySessionToken(token,secret,now=Date.now()) {
  if(!secret||typeof token!=="string")return null;
  const [payload,signature,...extra]=token.split(".");
  if(!payload||!signature||extra.length)return null;
  const expected=createHmac("sha256",secret).update(payload).digest();
  let actual;
  try{actual=Buffer.from(signature,"base64url");}catch{return null;}
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(typeof data.sub!=="string"||!data.sub||!Number.isInteger(data.exp)||data.exp<=Math.floor(now/1000))return null;
    return {id:data.sub,expiresAt:data.exp};
  }catch{return null;}
}
export function bearerToken(request) {
  const value=request.headers.authorization||"";
  return value.startsWith("Bearer ")?value.slice(7):null;
}

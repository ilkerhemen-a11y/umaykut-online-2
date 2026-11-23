import test from "node:test";
import assert from "node:assert/strict";
import {createSessionToken,verifySessionToken,hashPassword,verifyPassword,validateRegistration,normalizeEmail} from "../src/auth.js";
const secret="test-secret-that-is-long-enough-for-hmac-256";
test("registration validates username, email and password",()=>{
 assert.equal(validateRegistration({username:"Bey İlker",email:"BEY@example.com",password:"uzun-ve-guclu-sifre"}),null);
 assert.match(validateRegistration({username:"x",email:"bad",password:"123"}),/Oyuncu adı/);
 assert.equal(normalizeEmail("  BEY@Example.COM "),"bey@example.com");
});
test("password hashes verify without storing plain text",async()=>{
 const hash=await hashPassword("guclu-parola-123");assert.notEqual(hash,"guclu-parola-123");
 assert.equal(await verifyPassword("guclu-parola-123",hash),true);assert.equal(await verifyPassword("yanlis-parola",hash),false);
});
test("signed sessions reject tampering and expiry",()=>{
 const now=Date.UTC(2026,10,17),token=createSessionToken("player-123",secret,now);
 assert.equal(verifySessionToken(token,secret,now).id,"player-123");assert.equal(verifySessionToken(token+"x",secret,now),null);
 assert.equal(verifySessionToken(token,secret,now+8*24*60*60*1000),null);
});

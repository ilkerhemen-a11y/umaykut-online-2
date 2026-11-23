import pg from "pg";
const {Pool}=pg;
export function createPool(env=process.env){
  if(!env.DATABASE_URL)return null;
  return new Pool({
    connectionString:env.DATABASE_URL,
    ssl:env.DATABASE_SSL==="true"?{rejectUnauthorized:true}:undefined,
    max:5,
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:5000,
    application_name:"umaykut-online-2-v2"
  });
}

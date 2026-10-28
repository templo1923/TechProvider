const VERSION='v20.0'; const BASE=`https://graph.facebook.com/${VERSION}`;
async function graphFetch(path,{method='GET',token,body,params}={}){
  const qs=new URLSearchParams(params||{}); if(token) qs.set('access_token', token);
  let url=`${BASE}${path}?${qs.toString()}`; const opts={method,headers:{}}; if(body){ opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  const r=await fetch(url,opts); const j=await r.json().catch(()=>({})); if(!r.ok){ const err=new Error(j.error?.message||`Graph error ${r.status} ${path}`); err.details=j; err.status=r.status; throw err; } return j;
}
async function exchangeCodeForToken(code){
  const appId=process.env.FACEBOOK_APP_ID||'811281598468466';
  const appSecret=process.env.FACEBOOK_APP_SECRET;
  if(!appSecret) throw new Error('FACEBOOK_APP_SECRET missing in env — configure in Vercel');
  const params=new URLSearchParams({client_id:appId,client_secret:appSecret,code:code});
  const r=await fetch(`https://graph.facebook.com/${VERSION}/oauth/access_token?${params.toString()}`); const j=await r.json(); if(!j.access_token) throw new Error(j.error?.message||'Failed to exchange code for token'); return j.access_token;
}
module.exports={graphFetch,exchangeCodeForToken,VERSION};

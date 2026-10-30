import {edgeSecrets, publicHeaders} from '../../operations/edge.js';
// RSA-OAEP public key only. Its private half is kept off the website and Git.
const SPKI = "MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAllRT034YU9QqbGfijPBW/jmkXsgY8p8pA27VsJ5vb0qss4FYBdYwucT3O+ihzwzCCk1BdhAMCk6a0jXlx9YRi2kGOzcoxU+0mEHmCmEjzF+QNd+DJMsjUx20t8Mxro1e0cFJS5LLYoai2u15XOPhUpjajILRlTkXCgjrWbqa6GFzRqHu9ZQvhbmfJnjn0NhfbNe9TNrTHd+eqNo2ucQWw2/ZWWFGJy7VEP+lKYzNKAs2hk3NuSEF4G3u+PdQvJauX8prec6eGimuDFpPds6q1RgC+k7EuglsEjJkFYSDqb3UOmcgJxC0RVoQcw0BShXqM/LglUQImmgF1gN/azYF0hD8rt2afoOTOue1rZ2W5zh839Qzl/pEp+IWc4TDMAh78o8AeAQXwl+vlPBOt7gyg8XshMSDDiD8fF4x/AZZ/YDKsU6Yd4aHUawVwseUHmO4fTDsHs8t/mdv0UE7CmPz5hJn0FTwXVK7INnU4HE5O02YzTxrBAL78kheGxWcXf91AgMBAAE=";
export async function onRequest({request,env}) {
  if(request.method!=='GET')return new Response(null,{status:405});
  try {
    const payload=await edgeSecrets(env);
    const key=await crypto.subtle.importKey('spki',Uint8Array.from(atob(SPKI),c=>c.charCodeAt(0)),{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
    const encrypted=await crypto.subtle.encrypt('RSA-OAEP',key,new TextEncoder().encode(JSON.stringify(payload)));
    return Response.json({algorithm:'RSA-OAEP-SHA256',encrypted:btoa(String.fromCharCode(...new Uint8Array(encrypted)))},{headers:publicHeaders});
  }catch{return Response.json({ok:false,message:'尚未完成后台配置'},{status:503,headers:publicHeaders});}
}

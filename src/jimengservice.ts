import { requestUrl } from 'obsidian';
import { trimBase, type AiConfig } from './aiparse';
import { jimengBody } from './jimeng';
import type { SeedreamOptions, ImageResult, GeneratedPicture } from './seedream';
export async function jimengGenerate(c: AiConfig, prompt: string, width: number, height: number, options: SeedreamOptions = {}): Promise<ImageResult> {
  if (options.references?.length || options.layers || options.transparent) throw new Error('Jimeng: image editing is not enabled; use Seedream or Codex CLI');
  const body = jimengBody(c.imageModel, prompt, width, height, options.resolution, options.responseFormat ?? 'url');
  const own=!!c.imageBaseUrl.trim(), key=(own ? c.imageKey : c.imageKey || c.apiKey).trim();
  const res=await requestUrl({url:`${trimBase(c.imageBaseUrl || c.baseUrl)}/images/generations`,method:'POST',contentType:'application/json',headers:{Authorization:`Bearer ${key}`},body:JSON.stringify(body),throw:false});
  let payload:unknown; try {payload=res.json;} catch { /* plain error */ }
  const json=payload as {code?:number;message?:string;error?:{message?:string};data?:{url?:string;b64_json?:string}[]} | undefined;
  if(res.status>=400 || (json?.code !== undefined && json.code !== 0) || json?.error) throw new Error(`Jimeng HTTP ${res.status}: ${json?.message?.slice(0,240) ?? json?.error?.message?.slice(0,240) ?? 'request failed'}`);
  if (!Array.isArray(json?.data) || !json.data.length) throw new Error('Jimeng: no images returned');
  const pictures:GeneratedPicture[]=[], warnings:string[]=[];
  for(const item of json.data){try {
    let data:ArrayBuffer, type:string;
    if(item.b64_json){const bytes=Uint8Array.from(atob(item.b64_json),ch=>ch.charCodeAt(0));data=bytes.buffer;type=bytes[0]===0x89?'image/png':bytes[0]===0xff?'image/jpeg':String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':'';}
    else if(item.url && /^https:\/\//i.test(item.url)){const img=await requestUrl({url:item.url,throw:false});if(img.status>=400)throw Error(`Image download HTTP ${img.status}`);data=img.arrayBuffer;type=(img.headers['content-type']??'').split(';')[0]!.trim();}
    else throw Error('Jimeng: empty image item');
    if(!['image/png','image/jpeg','image/webp'].includes(type) || !data.byteLength)throw Error('Jimeng: invalid image response');
    pictures.push({data,type});
  }catch(e){warnings.push(e instanceof Error?e.message:String(e));}}
  if(!pictures.length)throw Error(warnings.join('\n') || 'Jimeng: no valid images');
  return {pictures,warnings};
}

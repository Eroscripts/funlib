import Discourse from 'discourse2'

export const headers = {
  'X-CSRF-Token': process.env.DISCOURSE_X_CSRF_TOKEN!,
  cookie: process.env.DISCOURSE_COOKIE!,
};
console.log(process.env.DISCOURSE_X_CSRF_TOKEN)

export const api = new Discourse('https://discuss.eroscripts.com', {
  headers,
  // 'Api-Key': process.env.DISCOURSE_API_KEY!,
  // 'Api-Username': process.env.DISCOURSE_API_USERNAME!,
})

console.log({
  ...headers,
  'Api-Key': process.env.DISCOURSE_API_KEY!,
  'Api-Username': process.env.DISCOURSE_API_USERNAME!,
})

export async function fetchScript(shortUrl: string) {
  const resp = await fetch(`https://discuss.eroscripts.com/uploads/short-url/${shortUrl}`, {
    headers: {
      ...headers,
      // 'Api-Key': process.env.DISCOURSE_API_KEY!,
      // 'Api-Username': process.env.DISCOURSE_API_USERNAME!,
    },
  })
  let disposition = resp.headers.get('content-disposition')!
  const filename = disposition.match(/filename\*=UTF-8''(.*)/i)![1]
  // console.log(disposition)
  return {
    json: await resp.json() as JsonFunscript,
    filename: decodeURIComponent(filename),
  }
}

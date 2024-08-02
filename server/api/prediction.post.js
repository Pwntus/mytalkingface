export default defineEventHandler(async (event) => {
  try {
    const { api_token, version, input } = await readBody(event)

    let url = 'https://api.replicate.com/v1/predictions'
    let body = {
      version,
      input
    }

    // Version is a model name (official model)
    if (version.includes('/')) {
      url = `https://api.replicate.com/v1/models/${version}/predictions`
      delete body.version
    }

    const result = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api_token}`
      },
      body: JSON.stringify(body)
    })

    const json = await result.json()

    return { data: json }
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})

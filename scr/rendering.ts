import { Funscript } from '@eroscripts/funlib'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'


export async function renderFunscript(fun: Funscript, zoom: number = 4) {
    const svgText = fun.toSvgElement()
    const { width, height } = svgText.match(/<svg width="(?<width>\d+)" height="(?<height>\d+)" /)!.groups!

    const resvg = new Resvg(svgText, {
        fitTo: { mode: 'zoom', value: zoom },
    })
    const webp = await sharp(resvg.render().asPng()).webp().toBuffer()
    return { width, height, webp }
}


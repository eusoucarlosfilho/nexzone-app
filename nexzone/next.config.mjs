/** @type {import('next').NextConfig} */
// Leitura do texto das imagens dos anúncios (análise automática): tesseract.js e sharp rodam fora do
// empacotamento do Next, e o idioma português + o motor do OCR vão junto nas funções que analisam anúncios.
const OCR = [
  './node_modules/tesseract.js/**/*',
  './node_modules/tesseract.js-core/**/*',
  './node_modules/@tesseract.js-data/por/4.0.0_best_int/**/*',
];
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js', 'sharp'],
    outputFileTracingIncludes: {
      '/vender/**/*': OCR,
      '/api/seller/product': OCR,
      '/api/admin/analise': OCR,
    },
  },
};
export default nextConfig;

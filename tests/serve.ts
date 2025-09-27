import index from './index.html'

Bun.serve({
  port: 3456,
  routes: {
    '/': index,
  },
})

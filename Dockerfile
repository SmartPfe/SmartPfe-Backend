FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get('http://127.0.0.1:5000/api/health',res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));"

CMD ["npm", "start"]

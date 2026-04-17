FROM node:22.14.0-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY .env.example ./.env.example

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0

EXPOSE 8787

CMD ["npm", "start"]

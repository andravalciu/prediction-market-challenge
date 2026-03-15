FROM oven/bun:1.3.9

WORKDIR /app

COPY package.json bun.lock tsconfig.json vite.config.ts components.json eslint.config.js ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=development
ENV VITE_API_URL=http://localhost:4001

EXPOSE 3000

CMD ["bun", "x", "vite", "dev", "--host", "0.0.0.0", "--port", "3000"]

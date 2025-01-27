FROM ubuntu:22.04

WORKDIR /root

ARG app

# Install necessary dependencies
RUN apt update && apt install -y curl gnupg2 software-properties-common

# Install Node.js and pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt install -y nodejs && \
    npm install -g pnpm@7.0.0 @nestjs/cli

# Copy project files
COPY . /root

# Install dependencies
RUN pnpm install --ignore-scripts

# Build the project
RUN pnpm build "$app"

CMD ["node", "dist/main.js"]  # Adjust to match your entry point

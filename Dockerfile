FROM golang:alpine AS builder

# Install build dependencies for SQLite (CGO)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build static binary
# -ldflags '-extldflags "-static"' ensures strictly static binary (no dynamic linking for C libraries)
RUN go build -ldflags '-extldflags "-static"' -o main .

FROM scratch

# Copy binary from builder
COPY --from=builder /app/main /main

# Expose port
EXPOSE 3000

# Run
CMD ["/main"]

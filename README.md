# QR Code Scavenger Hunt Game

## Running with Docker

1.  Build and run the container:
    ```bash
    docker-compose up --build
    ```
2.  Access the game at `http://localhost:3000`.
3.  The database `qrgame.db` will be persisted in the current directory.

## Development

- To run locally with hot-reloading (serving files from `./public`):
    ```bash
    go run .
    ```
- To build the binary:
    ```bash
    go build .
    ```

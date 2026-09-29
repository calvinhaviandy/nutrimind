export type User = {
  id: number
  name: string
  email: string
}

export type Session =
  | { authenticated: true; user: User }
  | { authenticated: false; user: null }

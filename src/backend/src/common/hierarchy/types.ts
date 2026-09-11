export interface TeamNode {
  id: string;
  name: string;
  email: string;
  depth: number;
  children: TeamNode[];
}

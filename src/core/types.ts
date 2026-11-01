export interface Vec3 { x: number; y: number; z: number }
export type Team = 'blue' | 'yellow';
export type Difficulty = 'beginner' | 'club' | 'pro';
export type ShotType = 'defend' | 'ground' | 'loft';
export type Direction = 'straight' | 'longOn' | 'cover' | 'leg' | 'point' | 'fineLeg' | 'thirdMan' | 'late';
export type Style = 'fast' | 'medium' | 'offSpin' | 'legSpin';
export type Length = 'yorker' | 'full' | 'good' | 'short' | 'bouncer';
export type Quality = 'perfect' | 'good' | 'mistimed' | 'miss';
export type Stroke = 'forwardDefense' | 'backDefense' | 'duck' | 'straightDrive' | 'coverDrive' | 'onDrive' | 'backPunch' | 'cut' | 'pull' | 'loftStraight' | 'loftDrive' | 'lateCut';
export interface Ball { position: Vec3; velocity: Vec3; bounced: boolean }
export interface Fielder { id: string; x: number; z: number; catchRadius: number; groundRadius: number }
export interface Delivery {
  id: number; style: Style; bowler: string; length: Length; variation: string;
  speed: number; release: Vec3; velocity: Vec3; swing: number; turn: number;
  restitution: number; bounce: Vec3; arrival: number; contact: Vec3;
  field: Fielder[]; fieldName: string; strategy: 'normal' | 'tactical' | 'surprise';
}
export interface Shot {
  type: ShotType; direction: Direction; stroke: Stroke; committedAt: number;
  contactAt: number; target: Vec3; angle: number; suitability: number;
  timingError: number; quality: Quality; raw: number; contribution: number;
}
export type Dismissal = 'bowled' | 'lbw' | 'caught';
export interface Outcome {
  runs: number; wicket?: Dismissal; dropped?: boolean; contribution: number;
  quality: Quality; direction?: Direction; shotType?: ShotType; timingError?: number;
}
export interface Batter {
  id: number; name: string; runs: number; balls: number; confidence: number;
  history: number[]; out: boolean; milestones: number[];
}
export interface Match {
  team: Team; difficulty: Difficulty; target: number; seed: number;
  runs: number; wickets: number; balls: number; striker: number; nonStriker: number;
  nextBatter: number; batters: Batter[]; outcomes: Outcome[];
  complete: boolean; won: boolean; paceStyle: Style; spinStyle: Style;
}
export type Phase = 'menu' | 'setup' | 'runup' | 'delivery' | 'outgoing' | 'feedback' | 'complete';
export interface BatPose { heel: Vec3; toe: Vec3; face: Vec3 }
export interface RenderFrame {
  time: number; phase: Phase; phaseTime: number; match: Match | null;
  delivery: Delivery | null; ball: Ball | null; shot: Shot | null;
  shotAge: number; marker: number; outcome: Outcome | null;
  milestone: boolean; debug: boolean;
}

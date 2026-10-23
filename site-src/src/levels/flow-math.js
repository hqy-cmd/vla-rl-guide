// Toy action space: a point encodes lateral clearance and a small longitudinal adjustment.
export const MEANS = [[-1.5, 1], [1.5, 1]];
export const SIGMA = .15;

// Linear flow-matching path: x_t = (1-t)·x0 + t·x1,
// x0 ~ N(0,I), x1 ~ 0.5 N(mu_left,sigma²I) + 0.5 N(mu_right,sigma²I).
// Within component k: x_t ~ N(t mu_k, s²I), s²=(1-t)²+t² sigma².
// Gaussian conditioning gives E[x1-x0 | x_t=x,k] =
// mu_k + (t sigma²-(1-t))/s² · (x-t mu_k).
// Sum these conditional velocities using the analytic GMM posterior p(k|x_t).
// Log-sum-exp normalization prevents underflow near the separated endpoints.
export function velocity(x, t) {
  const s2 = (1-t)**2 + t*t*SIGMA**2;
  const logs = MEANS.map(m => -((x[0]-t*m[0])**2+(x[1]-t*m[1])**2)/(2*s2));
  const max = Math.max(...logs), weights = logs.map(l => Math.exp(l-max));
  const total = weights[0]+weights[1], a = (t*SIGMA**2-(1-t))/s2;
  return [0,1].map(j => MEANS.reduce((u,m,k) => u+weights[k]/total*(m[j]+a*(x[j]-t*m[j])),0));
}
export function integrate(initial, steps) {
  const path = [initial.slice()];
  for (let i=0;i<steps;i++) {
    const x=path.at(-1), u=velocity(x,i/steps);
    path.push(x.map((value,j)=>value+u[j]/steps));
  }
  return path;
}
export function randomSource(seed=77) {
  return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
}
export function normal(random=Math.random) {
  return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
}
export function samplePaths(steps, count=150, random=Math.random) {
  return Array.from({length:count},()=>integrate([normal(random),normal(random)],steps));
}

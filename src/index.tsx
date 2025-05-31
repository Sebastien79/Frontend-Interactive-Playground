
/*

// React App

import ReactDOM from 'react-dom/client'; // ✅ Make sure this is correct
import { App } from '@components/App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

*/

// Single SPA App
import { registerApplication, start } from "single-spa";
import { bootstrap, mount, unmount, update } from "./spaLoader";

registerApplication(
  "LiveInteractivePlayground",
  () => import("./spaLoader"),
  () => true,
  { bootstrap, mount, unmount, update },
);

start();

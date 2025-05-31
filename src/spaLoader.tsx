import React from "react";
import ReactDOMClient from "react-dom/client";
import singleSpaReact from "single-spa-react";
import { InteractivePlaygroundApp } from "@components/InteractivePlayground";

const errorBoundary = (err: Error) => {
  console.error("Uncaught error", err);
  return <div>Error!</div>;
};

const parcel = (rootComponent: () => React.ReactElement) =>
  singleSpaReact({
    React,
    ReactDOMClient,
    rootComponent,
    errorBoundary,
  });

/** Parcel containing the Homepage */
export const LayoutComponentParcel = parcel(() => <InteractivePlaygroundApp />);

export const { bootstrap, mount, unmount, update } = LayoutComponentParcel;

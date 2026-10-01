import { Component, type ComponentType } from "react";

type Update<S> = Partial<S> | null | ((prev: S) => Partial<S> | null);

/**
 * Base class for a screen's logic. `state` updates synchronously, so a
 * functional setState always sees the latest value, and `renderVals()`
 * returns the flat object the view renders from.
 */
export class DCLogic<P = any, S = any> {
  props: P;
  state: S = {} as S;
  /** @internal */
  __host?: LogicHost;

  constructor(props: P) {
    this.props = props || ({} as P);
  }

  setState(update: Update<S>, cb?: () => void) {
    this.__host?.setLogicState(update as Update<any>, cb);
  }

  forceUpdate() {
    this.__host?.forceUpdate();
  }

  componentDidMount() {}
  componentDidUpdate(_prevProps: P) {}
  componentWillUnmount() {}

  renderVals(): Record<string, any> {
    return {};
  }
}

type HostProps = {
  logic: new (props: any) => DCLogic;
  view: ComponentType<{ v: any }>;
  props?: Record<string, any>;
};

/** Mounts a logic class and renders its view inside the host wrapper. */
export class LogicHost extends Component<HostProps, { n: number }> {
  logic: DCLogic;
  state = { n: 0 };

  constructor(p: HostProps) {
    super(p);
    this.logic = new p.logic(p.props || {});
    this.logic.__host = this;
  }

  setLogicState(update: Update<any>, cb?: () => void) {
    const prev = this.logic.state;
    const patch = typeof update === "function" ? update(prev) : update;
    this.logic.state = { ...prev, ...patch };
    this.setState((s) => ({ n: s.n + 1 }), cb);
  }

  componentDidMount() {
    this.logic.componentDidMount();
  }

  componentDidUpdate(prev: HostProps) {
    this.logic.props = this.props.props || {};
    this.logic.componentDidUpdate(prev.props || {});
  }

  componentWillUnmount() {
    this.logic.componentWillUnmount();
  }

  render() {
    const userProps = this.props.props || {};
    this.logic.props = userProps;
    const v = { ...userProps, ...this.logic.renderVals() };
    const View = this.props.view;
    return (
      <div className="sc-host">
        <View v={v} />
      </div>
    );
  }
}

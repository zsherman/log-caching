import React from 'react'

export default class ReportSize extends React.Component {
  refCallback = element => {
    if (element) {
      this.props.getSize(element.getBoundingClientRect());
    }
  };

  render() {
    return (
      <div ref={this.refCallback} style={{ border: "1px solid red" }}>
        <div style={{ wordBreak: 'break-all' }}>{this.props.message}</div>
      </div>
    );
  }
}
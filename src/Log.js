import React, { Component } from 'react'

export default class Log extends Component {
  render () {
    return (
      <div>{this.props.message}</div>
    )
  }
}

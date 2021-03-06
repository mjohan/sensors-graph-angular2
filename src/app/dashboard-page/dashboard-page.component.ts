import { Component, OnInit } from '@angular/core';

import { GraphOption } from "../classes/graph-option";
import { Datapoint } from "../classes/datapoint";
import { GraphEventService } from "../services/graph-event.service";
import { DatabankService } from "../services/databank.service";
import { RescuetimeService } from "../services/rescuetime.service";

import * as _ from 'lodash';

@Component({
  selector: 'dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {

  private today = new Date();
  private error = { message: '' };

  private emotions = [
    { index: 0, map: 'excitement', name: 'Engagement' },
    { index: 1, map: 'boredom', name: 'Boredom' },
    { index: 2, map: 'angriness', name: 'Frustration' },
    { index: 3, map: 'stress', name: 'Confusion' }
  ];

  private sensors = [
    { index: 0, map: 'rrInterval', name: 'RR interval' },
    { index: 1, map: 'gsr', name: 'Skin conductance' },
    { index: 2, map: 'accelerometer', name: 'Accelerometer' }
  ];

  private rtOptions = [
    { index: 0, map: RescuetimeService.TASKS_FILTER, name: 'Activities number' },
    { index: 1, map: RescuetimeService.PRODUCTIVITY_FILTER, name: 'Productivity level' },
    { index: 2, map: RescuetimeService.EMAIL_FILTER, name: 'Email duration' },
    { index: 3, map: RescuetimeService.ONLINE_CHAT_FILTER, name: 'Online chat duration' },
    { index: 4, map: RescuetimeService.SNS_FILTER, name: 'SNS duration' }
  ];

  private selected = { 
    emotion: this.emotions[0].index, 
    sensor: this.sensors[0].index,
    rtOption: this.rtOptions[0].index,
    username: '',
    dateRange: {
      beginDate: { year: this.today.getFullYear(), month: this.today.getMonth() + 1, day: this.today.getDate() - 1 },
      endDate: { year: this.today.getFullYear(), month: this.today.getMonth() + 1, day: this.today.getDate() }
    }
  };
  private lastSelected = { emotion: null, sensor: null, rtOption: null, userId: '', rtKey: '' };

  constructor(
    private graphEventService: GraphEventService,
    private databankService: DatabankService,
    private rescuetimeService: RescuetimeService) { }

  private getGraphDate() {
    let beginDate = this.selected.dateRange.beginDate;
    let endDate = this.selected.dateRange.endDate;

    return {
      start: new Date(beginDate.year, beginDate.month - 1, beginDate.day, 0, 0, 0, 0).getTime(),
      end: new Date(endDate.year, endDate.month - 1, endDate.day, 23, 59, 59, 999).getTime(),
    }
  }

  private rtDate() {
    let beginDate = this.selected.dateRange.beginDate;
    let endDate = this.selected.dateRange.endDate;

    return {
      start: beginDate.year + '-' + beginDate.month + '-' + beginDate.day,
      end: endDate.year + '-' + endDate.month + '-' + endDate.day
    }
  }

  private prepareGraphSeries(data: Datapoint[], options: GraphOption[], key: string, seriesType: string, yAxis: number, color: string, step: boolean): void {
    if (this.lastSelected[key] != null) {
      this.graphEventService.remove(options[this.lastSelected[key]].name);
    }

    this.graphEventService.add({
      name: options[this.selected[key]].name,
      type: seriesType,
      marker: { symbol: 'circle' },
      data: _.map(data, function(e: Datapoint) {
        return [ e.timestamp, e.value ];
      }),
      yAxis: yAxis,
      color: color,
      step: step
    });

    this.lastSelected[key] = this.selected[key];
  }

  private reloadEmotionGraph(): void {
    if (this.lastSelected.userId.length > 0) {
      this.graphEventService.load(true);
      this.databankService.retrieveEmotionValues(this.lastSelected.userId, this.emotions[this.selected.emotion].map, this.getGraphDate().start, this.getGraphDate().end)
        .then(sensordata => {
          this.prepareGraphSeries(sensordata, this.emotions, 'emotion', 'scatter', 2, '#db843d', false);
          this.graphEventService.load(false);
        }
      );
    } else {
      console.log("userId is empty");
    }
  }

  private reloadRTGraph(): void {
    if (this.lastSelected.rtKey.length > 0) {
      this.graphEventService.load(true);
      this.rescuetimeService.retrieveRescueTimeValues(this.lastSelected.rtKey, this.rtOptions[this.selected.rtOption].map, this.rtDate().start, this.rtDate().end)
        .then(rtData => {
          this.prepareGraphSeries(rtData, this.rtOptions, 'rtOption', 'line', 1, '#ac5f20', true);
          this.graphEventService.load(false);
        }
      );
    } else {
      console.log("rtKey is empty");
    }
  }

  private reloadSensorGraph(): void {
    if (this.lastSelected.userId.length > 0) {
      this.graphEventService.load(true);
      this.databankService.retrieveSensorValues(this.lastSelected.userId, this.sensors[this.selected.sensor].map, this.getGraphDate().start, this.getGraphDate().end)
        .then(sensordata => {
          this.prepareGraphSeries(sensordata, this.sensors, 'sensor', 'line', 0, '#db843d', false);
          this.graphEventService.load(false);
        }
      );
    } else {
      console.log("userId is empty");
    }
  }

  private searchData(): void {
    this.graphEventService.load(true);

    this.databankService.retrieveGraphUser(this.selected.username)
      .then(graphUser => {
        this.error.message = '';
        this.lastSelected.userId = graphUser.userId;
        this.lastSelected.rtKey = graphUser.rtKey;

        let start = this.getGraphDate().start;
        let end = this.getGraphDate().end;
        let sensorFilter = this.sensors[this.selected.sensor].map;
        let emotionFilter = this.emotions[this.selected.emotion].map;
        let rtFilter = this.rtOptions[this.selected.rtOption].map;

        this.databankService.retrieveSensorValues(graphUser.userId, sensorFilter, start, end)
          .then(sensorData => {
            this.databankService.retrieveEmotionValues(graphUser.userId, emotionFilter, start, end)
              .then(emotionData => {
                this.rescuetimeService.retrieveRescueTimeValues(graphUser.rtKey, rtFilter, this.rtDate().start, this.rtDate().end)
                  .then(rtData => {
                    this.prepareGraphSeries(sensorData, this.sensors, 'sensor', 'line', 0, '#814718', false);
                    this.prepareGraphSeries(rtData, this.rtOptions, 'rtOption', 'line', 1, '#ac5f20', true);
                    this.prepareGraphSeries(emotionData, this.emotions, 'emotion', 'scatter', 2, '#db843d', false);
                    this.graphEventService.load(false);

                    this.error.message = (sensorData.length > 0 || emotionData.length > 0 || rtData.length > 0) ? '' : 'No data found in this time period';
                  }).catch(() => this.error.message = 'Problem occurred when fetching data from RescueTime');
              });
          });
      }).catch(error => { this.error.message = error.message; this.graphEventService.load(false); } );
  }

  ngOnInit() { }
}

export class timeData {
    constructor(timeInSeconds) {
      this.milliseconds = timeInSeconds * 1000;
    }
  
    seconds() {
      return this.milliseconds / 1000;
    }
  
    setSeconds(seconds) {
      this.milliseconds = seconds * 1000;
    }
  
    minutes() {
      return this.seconds() / 60;
    }
  
    setMinutes(minutes) {
      this.milliseconds = minutes * 60 * 1000;
    }
  
    hours() {
      return this.minutes() / 60;
    }
  
    setHours(hours) {
      this.milliseconds = hours * 60 * 60 * 1000;
    }
  
    days() {
      return this.hours() / 24;
    }
  
    setDays(days) {
      this.milliseconds = days * 24 * 60 * 60 * 1000;
    }
  
    months() {
      return this.days() / 30;
    }
  
    setMonths(months) {
      this.milliseconds = months * 30 * 24 * 60 * 60 * 1000;
    }
  
    years() {
      return this.days() / 365;
    }
  
    setYears(years) {
      this.milliseconds = years * 365 * 24 * 60 * 60 * 1000;
    }
  
    string() {
      const totalSeconds = Math.floor(this.seconds());
      const years = Math.floor(totalSeconds / (365 * 24 * 60 * 60));
      const months = Math.floor((totalSeconds % (365 * 24 * 60 * 60)) / (30 * 24 * 60 * 60));
      const days = Math.floor((totalSeconds % (30 * 24 * 60 * 60)) / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;
  
      let timeString = '';
      if (years > 0) timeString += `${years}y `;
      if (months > 0) timeString += `${months}m `;
      if (days > 0) timeString += `${days}d `;
      if (hours > 0) timeString += `${hours}:`;
      timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
      return timeString;
    }
  
    setFromString(timeString) {
      if (!timeString) return;
      
      // Parse the time string
      let totalSeconds = 0;
      
      // Handle years
      let match = timeString.match(/(\d+)y/);
      if (match) totalSeconds += parseInt(match[1]) * 365 * 24 * 60 * 60;
      
      // Handle months
      match = timeString.match(/(\d+)m/);
      if (match) totalSeconds += parseInt(match[1]) * 30 * 24 * 60 * 60;
      
      // Handle days
      match = timeString.match(/(\d+)d/);
      if (match) totalSeconds += parseInt(match[1]) * 24 * 60 * 60;
      
      // Handle time in HH:MM:SS format
      const timeMatch = timeString.match(/(\d+)?:?(\d{2}):(\d{2})$/);
      if (timeMatch) {
        const hours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        
        totalSeconds += hours * 60 * 60 + minutes * 60 + seconds;
      }
      
      this.setSeconds(totalSeconds);
    }
  }
using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using System.ServiceProcess;
using System.Text;
using System.IO;
using Strategic.DataServices.HtmlParser;

namespace Strategic.DataServices.YahooQuoteService
{
    static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        static void Main(string[] args)
        {
            int numDaysToRequest = -3;
            // Request prices starting with today's date
            DateTime endDate = DateTime.Now;

            if (args.Length > 0)
            {
                switch (args.Length)
                {
                    case 1:
                        numDaysToRequest = int.Parse(args[0]);
                        if (numDaysToRequest > 0) numDaysToRequest *= -1;
                        break;
                    case 2:
                        numDaysToRequest = int.Parse(args[0]);
                        if (numDaysToRequest > 0) numDaysToRequest *= -1;
                        endDate = DateTime.Parse(args[1]);
                        break;
                }

            }
             
            // and get the day before just in case there were any updates
            DateTime beginDate = endDate.AddDays(numDaysToRequest);           

            // Read the XML File that has the symbols of the securities for which we
            // want to get quotes
            XDocument xDoc = XDocument.Load(SetDataPath() + "YahooQuoteServiceConfig.xml");

            // Run the Html Parser
            Requestor yahooQuotes = new Requestor();
            yahooQuotes.GetPricesFromSource(xDoc, beginDate, endDate);
        }

        static public string SetDataPath()
        {
            string path = Environment.CommandLine;


            while (path.StartsWith("\""))
            {
                path = path.Substring(1, path.Length - 2);
            }

            path = path.Substring(0, path.LastIndexOf(@"exe") + 3);

            path = Path.GetDirectoryName(path);

            return Path.Combine(path, "data\\");
        }
    }
}
